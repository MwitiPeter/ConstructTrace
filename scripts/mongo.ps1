# Starts, stops or checks the project-local MongoDB (no system service needed).
# Uses the mongod binary cached by mongodb-memory-server (with app-local VC runtime
# DLLs beside it when the system VC++ Redistributable is absent).
#
#   npm run mongo:start
#   npm run mongo:stop
#   npm run mongo:status
param([string]$Action = "start")

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

$searchDirs = @(
    (Join-Path $env:USERPROFILE ".cache\mongodb-binaries"),
    (Join-Path $root "server\node_modules\.cache\mongodb-memory-server")
)

function Find-Mongod {
    foreach ($dir in $searchDirs) {
        if (Test-Path $dir) {
            $found = Get-ChildItem -Path $dir -Filter "mongod-*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) { return $found.FullName }
        }
    }
    return $null
}

function Get-OurMongod {
    Get-CimInstance Win32_Process | Where-Object {
        $_.Name -like "mongod*.exe" -and $_.CommandLine -like "*.data*"
    }
}

$dbPath = Join-Path $root ".data\db"
$logPath = Join-Path $root ".data\mongod.log"

switch ($Action) {
    "start" {
        $listening = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
        if ($listening) { Write-Host "MongoDB already listening on 127.0.0.1:27017"; exit 0 }
        $exe = Find-Mongod
        if (-not $exe) {
            Write-Error "mongod binary not found. Run 'npm test' once (it downloads it) or install MongoDB."
            exit 1
        }
        New-Item -ItemType Directory -Force -Path $dbPath | Out-Null
        Start-Process -FilePath $exe -ArgumentList `
            "--dbpath", $dbPath, "--port", "27017", "--bind_ip", "127.0.0.1", `
            "--logappend", "--logpath", $logPath -WindowStyle Hidden
        Start-Sleep -Seconds 5
        if (Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue) {
            Write-Host "MongoDB started on 127.0.0.1:27017 (db: $dbPath)"
        } else {
            Write-Error "MongoDB failed to start — see $logPath"
            exit 1
        }
    }
    "stop" {
        $procs = Get-OurMongod
        if (-not $procs) { Write-Host "No project-local MongoDB running."; exit 0 }
        foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force; Write-Host "Stopped mongod PID $($p.ProcessId)" }
    }
    "status" {
        $listening = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
        if ($listening) { Write-Host "MongoDB is listening on 127.0.0.1:27017" }
        else { Write-Host "MongoDB is NOT running." }
    }
    default { Write-Error "Unknown action '$Action' (use start, stop or status)"; exit 1 }
}
