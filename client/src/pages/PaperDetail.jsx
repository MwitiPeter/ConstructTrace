import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Trash2,
  Boxes,
  Sparkles,
  FileText,
} from 'lucide-react';
import { api, apiUrl } from '../api.js';
import {
  Badge,
  Button,
  Card,
  ConfidenceMeter,
  EmptyState,
  ErrorBanner,
  Notice,
  PageChip,
  StatusBadge,
} from '../components/ui.jsx';
import Spinner from '../components/Spinner.jsx';

export default function PaperDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pageIdx, setPageIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    api(`/api/papers/${id}`)
      .then((d) => {
        setData(d);
        setPageIdx(0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [id, load]);

  const reanalyse = async () => {
    setBusy(true);
    setNotice('');
    try {
      const res = await api(`/api/papers/${id}/extract`, { method: 'POST' });
      setNotice(
        `Re-analysed: ${res.extraction.created} construct(s) extracted with the ${res.extraction.provider} provider${res.extraction.dropped ? `, ${res.extraction.dropped} dropped` : ''}.`
      );
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const projectId = data?.paper?.projectId;
      await api(`/api/papers/${id}`, { method: 'DELETE' });
      navigate(projectId ? `/projects/${projectId}` : '/projects');
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error || 'Paper not found.'} onRetry={load} />
        <Link to="/projects">
          <Button variant="secondary" icon={ArrowLeft}>
            Back to projects
          </Button>
        </Link>
      </div>
    );
  }

  const { paper, constructs } = data;
  const pages = paper.pages || [];
  const current = pages[Math.min(pageIdx, pages.length - 1)];

  return (
    <div className="space-y-5">
      <div>
        <Link
          to={`/projects/${paper.projectId}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to project
        </Link>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{paper.title}</h1>
                <StatusBadge status={paper.status} />
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                {paper.authors ? <span>{paper.authors}</span> : null}
                {paper.year ? <span>{paper.year}</span> : null}
                <span>{paper.pageCount} pages</span>
                <span>{constructs.length} constructs</span>
                <span>{paper.sourceType === 'pdf' ? 'PDF upload' : 'pasted text'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={RefreshCw} loading={busy} onClick={reanalyse}>
                Re-run AI analysis
              </Button>
              {paper.file?.storedName ? (
                <a href={apiUrl(`/api/papers/${id}/pdf`)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary" icon={Download}>
                    Download PDF
                  </Button>
                </a>
              ) : null}
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {error ? <ErrorBanner message={error} /> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Extracted constructs */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Boxes className="h-4 w-4 text-indigo-600" /> Extracted constructs
          </h2>
          {constructs.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No constructs extracted"
              description="Run the AI analysis again, or check that this paper contains explicit construct definitions."
            />
          ) : (
            <ul className="space-y-3">
              {constructs.map((c) => (
                <li
                  key={c._id}
                  className="animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft transition-shadow hover:shadow-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{c.name}</h3>
                    <ConfidenceMeter value={c.confidence} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <StatusBadge status={c.status} />
                    <Badge tone={c.source === 'human' ? 'emerald' : 'indigo'}>
                      {c.source === 'human' ? 'human-confirmed' : 'AI-extracted'}
                    </Badge>
                    {c.missingEvidence.length ? (
                      <Badge tone="amber">{c.missingEvidence.length} evidence gap(s)</Badge>
                    ) : null}
                  </div>

                  {c.definition ? (
                    <div className="evidence-box mt-3 px-3 py-2">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                        Definition <PageChip page={c.definition.page} />
                      </div>
                      <p className="text-sm italic text-slate-800">“{c.definition.text}”</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No definition located in the paper.</p>
                  )}

                  {c.evidenceQuotes.length ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Evidence
                      </p>
                      {c.evidenceQuotes.slice(0, 3).map((q, i) => (
                        <div key={`${q.page}-${i}`} className="border-l-2 border-slate-300 pl-3">
                          <div className="mb-0.5">
                            <PageChip page={q.page} />
                          </div>
                          <p className="text-sm text-slate-600">“{q.text}”</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Page text viewer */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FileText className="h-4 w-4 text-indigo-600" /> Extracted paper text
          </h2>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {pages.map((p, i) => (
                <button
                  key={p.page}
                  type="button"
                  onClick={() => setPageIdx(i)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    i === pageIdx
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  p. {p.page}
                </button>
              ))}
            </div>
            <div className="max-h-[560px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50/80 p-4 font-mono text-xs leading-relaxed text-slate-700 ring-1 ring-inset ring-slate-100">
              {current?.text || '(empty page)'}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Text is extracted locally from the PDF — quotes shown elsewhere come verbatim from
              these pages.
            </p>
          </div>
        </section>
      </div>

      {/* Delete confirmation */}
      <div
        className={`fixed inset-0 z-50 ${confirmDelete ? '' : 'hidden'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
        <div className="relative flex min-h-full items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-slate-900">Delete this paper?</h2>
            <p className="mt-2 text-sm text-slate-600">
              “{paper.title}” and its extracted constructs will be removed, along with any
              suggestions that depend on them.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="danger" loading={busy} onClick={remove}>
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
