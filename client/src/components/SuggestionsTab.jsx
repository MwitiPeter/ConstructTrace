import { useCallback, useEffect, useState } from 'react';
import { GitCompareArrows, Wand2, Filter } from 'lucide-react';
import { api } from '../api.js';
import { Button, EmptyState, ErrorBanner, Notice, Tabs } from './ui.jsx';
import Spinner from './Spinner.jsx';
import SuggestionCard from './SuggestionCard.jsx';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'uncertain', label: 'Uncertain' },
  { id: 'edited', label: 'Edited' },
];

const TYPE_TABS = [
  { id: 'all', label: 'All types' },
  { id: 'jingle', label: 'Jingle' },
  { id: 'jangle', label: 'Jangle' },
];

export default function SuggestionsTab({ projectId, onChanged }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
    api(`/api/projects/${projectId}/suggestions${query}`)
      .then((d) => setSuggestions(d.suggestions))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, statusFilter]);

  useEffect(load, [load]);

  const runComparison = async () => {
    setComparing(true);
    setError('');
    setResult(null);
    try {
      const r = await api(`/api/projects/${projectId}/compare`, { method: 'POST' });
      if (r.reason === 'needs_at_least_two_constructs') {
        setResult({ tone: 'warn', text: 'At least two extracted constructs are needed — analyse more papers first.' });
      } else if (r.created === 0) {
        setResult({ tone: 'info', text: `Comparison complete: no new suggestions (${r.skipped} already known).` });
      } else {
        setResult({
          tone: 'success',
          text: `Comparison complete: ${r.created} new suggestion(s) found (${r.total - r.skipped} jingle/jangle candidates evaluated this run).`,
        });
      }
      setStatusFilter('all');
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setComparing(false);
    }
  };

  const onUpdated = (updated) => {
    setSuggestions((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
    onChanged?.();
  };

  const filtered = suggestions.filter((s) => typeFilter === 'all' || s.type === typeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200/70 bg-slate-100/90 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                statusFilter === f.id
                  ? 'bg-white text-indigo-700 shadow-soft'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button icon={comparing ? Wand2 : GitCompareArrows} loading={comparing} onClick={runComparison}>
          Run comparison
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Filter className="h-4 w-4" />
        <div className="w-64">
          <Tabs tabs={TYPE_TABS} active={typeFilter} onChange={setTypeFilter} />
        </div>
      </div>

      {result ? <Notice tone={result.tone}>{result.text}</Notice> : null}
      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-7 w-7 text-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={GitCompareArrows}
          title={
            statusFilter === 'pending' && suggestions.length === 0
              ? 'No suggestions awaiting review'
              : 'Nothing matches this filter'
          }
          description="Suggestions appear after two or more papers have been analysed. Run a comparison to (re)evaluate all construct pairs — previous decisions are never overwritten."
          action={
            <Button icon={GitCompareArrows} loading={comparing} onClick={runComparison}>
              Run comparison
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Showing {filtered.length} {typeFilter === 'all' ? '' : `${typeFilter} `}suggestion
            {filtered.length === 1 ? '' : 's'} — every item needs your decision.
          </p>
          {filtered.map((s) => (
            <SuggestionCard key={s._id} suggestion={s} onUpdated={onUpdated} />
          ))}
        </div>
      )}
    </div>
  );
}
