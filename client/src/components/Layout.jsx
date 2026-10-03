import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, LogOut, Menu, X, ScanSearch } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
];

function BrandMark({ size = 'lg' }) {
  const dims = size === 'lg' ? 'h-9 w-9 rounded-xl' : 'h-8 w-8 rounded-lg';
  return (
    <span
      className={`brand-gradient inline-flex items-center justify-center text-white shadow-glow ${dims}`}
    >
      <ScanSearch className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
    </span>
  );
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1.5 px-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-soft'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-soft'
              }`
            }
          >
            <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function UserPanel({ user, onLogout, loggingOut }) {
  const initial = (user?.name || '?').charAt(0).toUpperCase();
  return (
    <div className="border-t border-slate-200/70 p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-soft">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-soft transition-all hover:border-rose-200 hover:bg-rose-50/50 hover:text-rose-600 disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <BrandMark size="sm" />
          <span className="text-sm font-bold tracking-tight text-slate-900">ConstructTrace</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/70 bg-white/85 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <BrandMark />
          <div>
            <p className="text-sm font-bold leading-tight tracking-tight text-slate-900">
              ConstructTrace
            </p>
            <p className="text-[11px] leading-tight text-slate-500">Jingle &amp; Jangle detection</p>
          </div>
        </div>
        <div className="mt-3 flex-1">
          <p className="px-6 pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Research
          </p>
          <NavItems />
        </div>
        <UserPanel user={user} onLogout={handleLogout} loggingOut={loggingOut} />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-lift animate-pop-in">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-2.5">
                <BrandMark size="sm" />
                <span className="text-sm font-bold tracking-tight text-slate-900">
                  ConstructTrace
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
            <UserPanel user={user} onLogout={handleLogout} loggingOut={loggingOut} />
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
