import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban as FolderKanbanIcon,
  FileText as FileTextIcon,
  Boxes as BoxesIcon,
  ClipboardCheck as ClipboardCheckIcon,
  Plus as PlusIcon,
  Sparkles as SparklesIcon,
  User as UserIcon,
  Bot as BotIcon,
  Settings as SettingsIcon,
  ArrowRight as ArrowRightIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../api.js';
import { Button, Card, EmptyState, ErrorBanner, StatusBadge } from '../components/ui.jsx';
import Spinner from '../components/Spinner.jsx';

const PIE_COLORS = {
  pending: '#f59e0b',
  uncertain: '#0ea5e9',
  edited: '#8b5cf6',
  accepted: '#10b981',
  rejected: '#f43f5e',
};

const ACTOR_ICON = { ai: BotIcon, user: UserIcon, system: SettingsIcon };

function StatCard({ icon: Icon, label, value, hint, tone, delay = 0 }) {
  const tones = {
    indigo: 'from-indigo-500 to-violet-500',
    sky: 'from-sky-400 to-cyan-500',
    violet: 'from-violet-500 to-fuchsia-500',
    amber: 'from-amber-400 to-orange-500',
  };
  return (
    <Card
      className="animate-fade-up p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-soft ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api('/api/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return null;

  const { totals } = data;

  if (totals.projects === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Dashboard</h1>
        <EmptyState
          icon={FolderKanbanIcon}
          title="Create your first research project"
          description="Projects group the papers you want to compare for jingle and jangle fallacies."
          action={
            <Link to="/projects">
              <Button icon={PlusIcon}>New project</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const chartData = data.perProject.map((p) => ({
    name: p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name,
    Papers: p.papers,
    Constructs: p.constructs,
  }));
  const pieData = data.suggestionStatus.filter((s) => s.count > 0);
  const typeData = data.suggestionType.filter((t) => t.count > 0);

  return (
    <div className="space-y-6">
      <div className="hero-gradient relative overflow-hidden rounded-2xl px-6 py-6 text-white shadow-lift">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-indigo-100">
              Overview of your construct audits across all projects.
            </p>
          </div>
          <Link to="/projects">
            <Button variant="secondary" icon={PlusIcon} className="border-white/40 text-slate-800">
              New project
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={FolderKanbanIcon}
          label="Projects"
          value={totals.projects}
          hint="Research projects"
          tone="indigo"
          delay={0}
        />
        <StatCard
          icon={FileTextIcon}
          label="Papers"
          value={totals.papers}
          hint={`${totals.analyzedPapers} analyzed by AI`}
          tone="sky"
          delay={60}
        />
        <StatCard
          icon={BoxesIcon}
          label="Constructs"
          value={totals.constructs}
          hint="Extracted across papers"
          tone="violet"
          delay={120}
        />
        <StatCard
          icon={ClipboardCheckIcon}
          label="Pending reviews"
          value={totals.pending}
          hint={`${totals.accepted} accepted · ${totals.rejected} rejected`}
          tone="amber"
          delay={180}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            Papers &amp; constructs per project
          </h2>
          {chartData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Papers" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Constructs" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No data yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
            Suggestions by status
          </h2>
          {pieData.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.status} fill={PIE_COLORS[entry.status] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <SparklesIcon className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">No suggestions yet.</p>
              <p className="text-xs text-slate-400">Upload 2+ papers and run a comparison.</p>
            </div>
          )}
          {typeData.length ? (
            <div className="mt-3 flex justify-center gap-4 text-xs text-slate-600">
              {typeData.map((t) => (
                <span key={t.type} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: t.type === 'jingle' ? '#f59e0b' : '#8b5cf6' }}
                  />
                  {t.type}: <strong>{t.count}</strong>
                </span>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Recent activity</h2>
            <span className="text-xs text-slate-400">AI actions &amp; your decisions</span>
          </div>
          {data.recentActivity.length ? (
            <ul className="divide-y divide-slate-100">
              {data.recentActivity.map((ev) => {
                const Icon = ACTOR_ICON[ev.actorType] || SparklesIcon;
                return (
                  <li key={ev._id} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        ev.actorType === 'ai'
                          ? 'bg-amber-100 text-amber-700'
                          : ev.actorType === 'user'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">{ev.message}</p>
                      <p className="text-xs text-slate-400">
                        {ev.actorType === 'ai' ? 'AI' : ev.actorType === 'user' ? 'Researcher' : 'System'}
                        {ev.label ? ` · ${ev.label}` : ''} ·{' '}
                        {new Date(ev.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No activity recorded yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Projects</h2>
          <ul className="space-y-3">
            {data.perProject.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="group flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 transition hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.papers} papers · {p.constructs} constructs
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.status === 'archived' ? <StatusBadge status="archived">archived</StatusBadge> : null}
                    <ArrowRightIcon className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/projects" className="mt-4 block">
            <Button variant="secondary" size="sm" className="w-full">
              View all projects
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
