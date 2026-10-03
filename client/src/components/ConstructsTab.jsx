import { Fragment, useCallback, useEffect, useState } from 'react';
import { Boxes, ChevronDown, ChevronRight, BadgeCheck, Quote } from 'lucide-react';
import { api } from '../api.js';
import {
  Badge,
  Button,
  ConfidenceMeter,
  EmptyState,
  ErrorBanner,
  PageChip,
  StatusBadge,
} from './ui.jsx';
import Spinner from './Spinner.jsx';

export default function ConstructsTab({ projectId }) {
  const [constructs, setConstructs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    api(`/api/projects/${projectId}/constructs`)
      .then((d) => setConstructs(d.constructs))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);

  const toggleVerify = async (c) => {
    setBusyId(c._id);
    try {
      await api(`/api/constructs/${c._id}`, {
        method: 'PATCH',
        body: { status: c.status === 'verified' ? 'extracted' : 'verified' },
      });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-7 w-7 text-indigo-600" />
      </div>
    );
  }
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!constructs.length) {
    return (
      <EmptyState
        icon={Boxes}
        title="No constructs extracted yet"
        description="Upload or paste papers first — the AI provider extracts construct names, definitions, measurement items and quotations with page numbers."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Construct</th>
              <th className="px-4 py-3 font-semibold">Paper</th>
              <th className="px-4 py-3 font-semibold">Definition</th>
              <th className="px-4 py-3 font-semibold">Items</th>
              <th className="px-4 py-3 font-semibold">Confidence</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {constructs.map((c) => {
              const isOpen = expanded === c._id;
              return (
                <Fragment key={c._id}>
                  <tr className={isOpen ? 'bg-indigo-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">
                      {c.paperTitle}
                    </td>
                    <td className="max-w-[280px] px-4 py-3">
                      {c.definition ? (
                        <span className="line-clamp-2 text-slate-600">
                          {c.definition.text} <PageChip page={c.definition.page} />
                        </span>
                      ) : (
                        <Badge tone="amber">missing definition</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.measurementItems.length}</td>
                    <td className="px-4 py-3">
                      <ConfidenceMeter value={c.confidence} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={c.status === 'verified' ? 'success' : 'secondary'}
                        icon={BadgeCheck}
                        loading={busyId === c._id}
                        onClick={() => toggleVerify(c)}
                      >
                        {c.status === 'verified' ? 'Verified' : 'Verify'}
                      </Button>
                      <button
                        type="button"
                        className="ml-1 rounded p-1.5 text-slate-400 hover:bg-slate-100"
                        onClick={() => setExpanded(isOpen ? null : c._id)}
                        aria-label="Toggle evidence"
                      >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-indigo-50/40">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Definition
                            </p>
                            {c.definition ? (
                              <div className="evidence-box px-3 py-2">
                                <p className="text-sm italic text-slate-800">“{c.definition.text}”</p>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-indigo-700">
                                  <PageChip page={c.definition.page} /> <span>{c.paperTitle}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-500">
                                No definition could be located in the paper.
                              </p>
                            )}

                            {c.missingEvidence.length ? (
                              <div className="interpretation-box mt-3 px-3 py-2">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                                  Missing / uncertain evidence
                                </p>
                                <ul className="list-inside list-disc text-sm text-slate-700">
                                  {c.missingEvidence.map((m) => (
                                    <li key={m}>{m}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-4">
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Supporting quotations
                              </p>
                              <ul className="space-y-2">
                                {c.evidenceQuotes.map((q, i) => (
                                  <li key={`${q.page}-${i}`} className="evidence-box px-3 py-2">
                                    <div className="mb-1 flex items-center gap-2 text-[11px] text-indigo-700">
                                      <Quote className="h-3 w-3" /> <PageChip page={q.page} />
                                    </div>
                                    <p className="text-sm italic text-slate-800">“{q.text}”</p>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {c.measurementItems.length ? (
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Measurement items
                                </p>
                                <ul className="space-y-1.5">
                                  {c.measurementItems.map((m, i) => (
                                    <li
                                      key={`${m.page}-${i}`}
                                      className="flex items-start gap-2 text-sm text-slate-700"
                                    >
                                      <PageChip page={m.page} />
                                      <span>{m.text}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <Badge tone={c.source === 'human' ? 'emerald' : 'indigo'}>
                                {c.source === 'human' ? 'human-confirmed' : 'AI-extracted'}
                              </Badge>
                              <Badge tone="slate">provider: {c.provider}</Badge>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
