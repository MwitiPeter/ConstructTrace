import { useEffect } from 'react';
import { X, AlertTriangle, FileText, Sparkles, Inbox } from 'lucide-react';
import Spinner from './Spinner.jsx';

/* ------------------------------------------------------------------ Button */

const BTN_VARIANTS = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-soft hover:from-indigo-500 hover:to-violet-500 hover:shadow-glow',
  secondary:
    'bg-white text-slate-700 border border-slate-200/80 shadow-soft hover:border-indigo-200 hover:bg-indigo-50/40',
  success:
    'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-soft hover:from-emerald-400 hover:to-teal-400',
  danger:
    'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-soft hover:from-rose-400 hover:to-red-400',
  ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
  warning:
    'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-soft hover:from-amber-400 hover:to-orange-400',
};

const BTN_SIZES = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  children,
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-soft ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200/80',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200/80',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200/80',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/80',
};

export function Badge({ tone = 'slate', icon: Icon, dot = false, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}

const STATUS_TONES = {
  pending: 'amber',
  accepted: 'emerald',
  rejected: 'rose',
  uncertain: 'sky',
  edited: 'violet',
  parsed: 'sky',
  analyzed: 'emerald',
  processing: 'amber',
  failed: 'rose',
  verified: 'emerald',
  extracted: 'indigo',
  active: 'emerald',
  archived: 'slate',
};

export function StatusBadge({ status, children }) {
  return (
    <Badge tone={STATUS_TONES[status] || 'slate'} dot>
      {children || status}
    </Badge>
  );
}

export function TypeBadge({ type }) {
  return type === 'jingle' ? (
    <Badge tone="amber" dot>
      Jingle fallacy
    </Badge>
  ) : (
    <Badge tone="violet" dot>
      Jangle fallacy
    </Badge>
  );
}

/* ------------------------------------------------------------ Empty/Error */

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-white/60 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-inset ring-indigo-100">
        <Icon className="h-7 w-7 text-indigo-500" />
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-rose-200/80 bg-rose-50/80 px-3.5 py-2.5 text-sm text-rose-700 shadow-soft">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button
          type="button"
          className="rounded-md px-1.5 font-semibold underline hover:bg-rose-100 hover:text-rose-900"
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function Notice({ tone = 'success', children }) {
  if (!children) return null;
  const tones = {
    success: 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800',
    info: 'border-sky-200/80 bg-sky-50/80 text-sky-800',
    warn: 'border-amber-200/80 bg-amber-50/80 text-amber-800',
  };
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm shadow-soft ${tones[tone]}`}
    >
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Forms */

export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-soft placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition';

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = '', ...props }) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function TextArea({ className = '', rows = 4, ...props }) {
  return <textarea rows={rows} className={`${inputClass} resize-y ${className}`} {...props} />;
}

/* ------------------------------------------------------------------ Modal */

export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div
          className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} animate-pop-in overflow-hidden rounded-2xl bg-white shadow-lift`}
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-5 py-3.5">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white hover:text-slate-600 hover:shadow-soft"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ Evidence widgets */

export function PageChip({ page }) {
  if (page === null || page === undefined) return null;
  return (
    <span className="inline-flex items-center rounded-md bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
      p. {page}
    </span>
  );
}

/** Verbatim quotation taken from an uploaded paper (a fact). */
export function EvidenceQuote({ quote, page, paperTitle }) {
  return (
    <div className="evidence-box px-3.5 py-2.5">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
        <FileText className="h-3 w-3" />
        <span>Source evidence</span>
        {paperTitle ? (
          <span className="font-normal normal-case text-slate-500">· {paperTitle}</span>
        ) : null}
        <PageChip page={page} />
      </div>
      <p className="text-sm italic leading-relaxed text-slate-800">“{quote}”</p>
    </div>
  );
}

/** Model-generated interpretation (never a fact, always needs approval). */
export function InterpretationBox({ children }) {
  return (
    <div className="interpretation-box px-3.5 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
        <Sparkles className="h-3 w-3" />
        <span>AI interpretation — requires your review</span>
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{children}</p>
    </div>
  );
}

export function ConfidenceMeter({ value = 0 }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.75
      ? 'from-emerald-400 to-teal-500'
      : value >= 0.5
        ? 'from-amber-400 to-orange-500'
        : 'from-rose-400 to-red-500';
  const label = value >= 0.75 ? 'High' : value >= 0.5 ? 'Medium' : 'Low';
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full bg-slate-50 py-1 pl-1 pr-2.5 ring-1 ring-inset ring-slate-200/70"
      title={`Confidence ${pct}%`}
    >
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-1.5 rounded-full bg-gradient-to-r ${tone} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-600">
        {label} · {pct}%
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------- Tabs */

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100/90 p-1 shadow-inner">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-white text-indigo-700 shadow-soft ring-1 ring-inset ring-white'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
            }`}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {t.label}
            {t.count !== undefined && t.count !== null ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200/80 text-slate-500'
                }`}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
