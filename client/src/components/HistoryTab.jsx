import { useCallback, useEffect, useState } from 'react';
import { History, Bot, User, Settings, Sparkles } from 'lucide-react';
import { api } from '../api.js';
import { Badge, EmptyState, ErrorBanner } from './ui.jsx';
import Spinner from './Spinner.jsx';

const ACTOR_META = {
  ai: { icon: Bot, tone: 'bg-amber-100 text-amber-700', label: 'AI' },
  user: { icon: User, tone: 'bg-indigo-100 text-indigo-700', label: 'Researcher' },
  system: { icon: Settings, tone: 'bg-slate-100 text-slate-600', label: 'System' },
};

const ACTION_TONE = (action = '') => {
  if (action.startsWith('decision.accept')) return 'emerald';
  if (action.startsWith('decision.reject')) return 'rose';
  if (action.startsWith('decision.uncertain')) return 'sky';
  if (action.startsWith('decision.edit')) return 'violet';
  if (action.startsWith('ai.')) return 'amber';
  return 'slate';
};

export default function HistoryTab({ projectId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/api/projects/${projectId}/history`)
      .then((d) => setEvents(d.events))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-7 w-7 text-indigo-600" />
      </div>
    );
  }
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!events.length) {
    return (
      <EmptyState
        icon={History}
        title="No history yet"
        description="Every AI action and every decision you make is recorded here with timestamps."
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft sm:p-5">
      <ul className="relative space-y-5 border-l-2 border-indigo-100 pl-5 sm:pl-6">
        {events.map((ev) => {
          const meta = ACTOR_META[ev.actorType] || ACTOR_META.system;
          const Icon = meta.icon;
          return (
            <li key={ev._id} className="relative">
              <span
                className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white sm:-left-[35px] shadow-soft ${meta.tone}`}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ACTION_TONE(ev.action)}>{ev.action}</Badge>
                <span className="text-xs text-slate-400">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{ev.message}</p>
              {ev.details && (ev.details.note || ev.details.label || ev.details.rationale) ? (
                <div className="mt-1 rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                  {ev.details.label ? <p>Label: “{ev.details.label}”</p> : null}
                  {ev.details.rationale ? <p>Rationale: {ev.details.rationale}</p> : null}
                  {ev.details.note ? <p>Note: {ev.details.note}</p> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
        <Sparkles className="h-3 w-3" /> Showing the latest {events.length} events (max 300).
      </div>
    </div>
  );
}
