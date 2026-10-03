import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ScanSearch, ShieldCheck, FileText, GitCompareArrows, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, Field, Input, ErrorBanner } from '../components/ui.jsx';

const HIGHLIGHTS = [
  { icon: FileText, text: 'Extract constructs, definitions and quotations with page numbers from real PDFs.' },
  { icon: GitCompareArrows, text: 'Detect jingle (same name, different meaning) and jangle (different name, same meaning) risks.' },
  { icon: ShieldCheck, text: 'Every AI suggestion carries verifiable evidence — no invented quotes or citations.' },
  { icon: CheckCircle2, text: 'You stay in control: accept, reject, edit or flag every suggestion as uncertain.' },
];

export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => {
    setMode('login');
    setEmail('demo@constructtrace.app');
    setPassword('demo1234');
    setError('');
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hero-gradient relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
        {/* decorative light orbs */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-[420px] w-[420px] rounded-full bg-sky-300/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-1/3 left-1/3 h-64 w-64 rounded-full bg-fuchsia-300/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="glass flex h-11 w-11 items-center justify-center rounded-xl text-white">
            <ScanSearch className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-bold leading-tight tracking-tight">ConstructTrace</p>
            <p className="text-sm text-indigo-200">Jingle &amp; jangle fallacy detection</p>
          </div>
        </div>

        <div className="relative">
          <h1 className="max-w-lg text-3xl font-bold leading-snug tracking-tight xl:text-4xl">
            Keep your construct definitions honest across every paper you review.
          </h1>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon;
              return (
                <li key={h.text} className="flex max-w-xl items-start gap-3 text-sm text-indigo-100">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-inset ring-white/20 backdrop-blur">
                    <Icon className="h-4 w-4" />
                  </span>
                  {h.text}
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative text-xs text-indigo-200">
          Runs 100% on free tools: React · Express · MongoDB · local rule-based AI (Hugging Face
          optional).
        </p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <span className="brand-gradient inline-flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-glow">
                <ScanSearch className="h-5 w-5" />
              </span>
              <span className="font-bold tracking-tight text-slate-900">ConstructTrace</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'login'
                ? 'Sign in to your research dashboard.'
                : 'Start auditing constructs across your papers.'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {error ? <ErrorBanner message={error} /> : null}

            {mode === 'register' ? (
              <Field label="Full name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  required
                  minLength={2}
                />
              </Field>
            ) : null}

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@university.edu"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password" hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
              />
            </Field>

            <Button type="submit" loading={busy} className="w-full" size="lg">
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-3 text-center text-sm shadow-soft">
            {mode === 'login' ? (
              <>
                <span className="text-slate-600">New here? </span>
                <button
                  type="button"
                  className="font-semibold text-indigo-600 hover:underline"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                <span className="text-slate-600">Already registered? </span>
                <button
                  type="button"
                  className="font-semibold text-indigo-600 hover:underline"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={useDemo}
            className="mt-3 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
          >
            Fill in the seeded demo account (demo@constructtrace.app / demo1234)
          </button>
        </div>
      </div>
    </div>
  );
}
