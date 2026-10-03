import { useState } from 'react';
import { Check, X, HelpCircle, Pencil, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { api } from '../api.js';
import {
  Button,
  ConfidenceMeter,
  EvidenceQuote,
  InterpretationBox,
  Modal,
  StatusBadge,
  TextArea,
  TypeBadge,
  ErrorBanner,
} from './ui.jsx';

const DECISION_LABEL = {
  accept: 'Accepted by you',
  reject: 'Rejected by you',
  uncertain: 'Marked uncertain by you',
  edit: 'Edited by you',
};

export default function SuggestionCard({ suggestion, onUpdated }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ note: '', label: '', rationale: '' });

  const decide = async (action, extra = {}) => {
    setBusy(action);
    setError('');
    try {
      const d = await api(`/api/suggestions/${suggestion._id}/decision`, {
        method: 'POST',
        body: { action, ...extra },
      });
      setEditOpen(false);
      onUpdated?.(d.suggestion);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const s = suggestion;
  const decided = s.status !== 'pending';

  return (
    <article className="animate-fade-up overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft transition-shadow duration-200 hover:shadow-card">
      {/* Header: pairing strip */}
      <div className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/60 px-4 py-3.5 sm:px-5">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={s.type} />
            {decided ? <StatusBadge status={s.status} /> : null}
            {!s.evidenceComplete ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                <AlertTriangle className="h-3 w-3" /> incomplete evidence
              </span>
            ) : null}
          </div>
          <ConfidenceMeter value={s.confidence} />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 shadow-chip ring-1 ring-inset ring-slate-200/70">
            {s.names[0]}
          </span>
          <span className="brand-gradient inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white shadow-soft">
            <ArrowLeftRight className="h-3 w-3" />
          </span>
          <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 shadow-chip ring-1 ring-inset ring-slate-200/70">
            {s.names[1]}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        {error ? <ErrorBanner message={error} /> : null}

        {/* AI interpretation — clearly separated from facts */}
        <InterpretationBox>{s.rationale}</InterpretationBox>

        {/* Verbatim evidence with paper + page */}
        <div className="space-y-2">
          {s.evidence.map((ev, i) => (
            <EvidenceQuote
              key={`${ev.constructId || i}`}
              quote={ev.quote || 'No quotation available — inspect the paper manually.'}
              page={ev.page}
              paperTitle={ev.paperTitle}
            />
          ))}
        </div>

        {decided && (s.decision?.note || s.decision?.label || s.decision?.rationale) ? (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {DECISION_LABEL[s.decision.action] || 'Your decision'}
              {s.decision.userName ? ` — ${s.decision.userName}` : ''}
            </p>
            {s.decision.label ? (
              <p className="text-sm font-medium text-slate-800">“{s.decision.label}”</p>
            ) : null}
            {s.decision.rationale ? (
              <p className="text-sm text-slate-600">{s.decision.rationale}</p>
            ) : null}
            {s.decision.note ? <p className="text-sm text-slate-600">{s.decision.note}</p> : null}
          </div>
        ) : null}

        {/* Actions — researcher has the final word */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
          <Button
            size="sm"
            variant={s.status === 'accepted' ? 'success' : 'secondary'}
            icon={Check}
            loading={busy === 'accept'}
            onClick={() => decide('accept')}
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant={s.status === 'rejected' ? 'danger' : 'secondary'}
            icon={X}
            loading={busy === 'reject'}
            onClick={() => decide('reject')}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant={s.status === 'uncertain' ? 'warning' : 'secondary'}
            icon={HelpCircle}
            loading={busy === 'uncertain'}
            onClick={() => decide('uncertain')}
          >
            Uncertain
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={Pencil}
            onClick={() => {
              setEditForm({
                note: s.decision?.note || '',
                label: s.decision?.label || '',
                rationale: s.decision?.rationale || '',
              });
              setEditOpen(true);
            }}
          >
            Edit
          </Button>
          <span className="ml-auto text-xs text-slate-400">
            Similarity {(s.score * 100).toFixed(0)}% · AI: {s.aiProvider}
          </span>
        </div>
      </div>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit this suggestion"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy === 'edit'} onClick={() => decide('edit', editForm)}>
              Save decision
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Your edit becomes the authoritative label for this relationship. The original AI
            interpretation stays visible in the history.
          </p>
          <TextArea
            rows={2}
            placeholder="Corrected relationship label (optional)"
            value={editForm.label}
            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
          />
          <TextArea
            rows={3}
            placeholder="Your rationale (optional)"
            value={editForm.rationale}
            onChange={(e) => setEditForm({ ...editForm, rationale: e.target.value })}
          />
          <TextArea
            rows={2}
            placeholder="Reviewer note (optional)"
            value={editForm.note}
            onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
          />
        </div>
      </Modal>
    </article>
  );
}
