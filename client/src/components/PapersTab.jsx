import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  ClipboardType,
  FileText,
  Download,
  RefreshCw,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { api, apiUrl } from '../api.js';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  Notice,
  StatusBadge,
  TextArea,
} from './ui.jsx';
import Spinner from './Spinner.jsx';

function summarise(res) {
  const parts = [`Extracted ${res.extraction.created} construct(s) with the ${res.extraction.provider} provider.`];
  if (res.extraction.dropped) parts.push(`${res.extraction.dropped} unverifiable item(s) dropped.`);
  if (res.comparison?.created) parts.push(`${res.comparison.created} new fallacy suggestion(s) found.`);
  return parts.join(' ');
}

export default function PapersTab({ projectId, onChanged }) {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState({ title: '', text: '' });
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInput = useRef(null);

  const load = useCallback(() => {
    api(`/api/projects/${projectId}/papers`)
      .then((d) => setPapers(d.papers))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(load, [load]);

  const handleUpload = async () => {
    if (!file) {
      setUploadError('Choose a PDF file first.');
      return;
    }
    setUploading(true);
    setUploadError('');
    setNotice('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api(`/api/projects/${projectId}/papers`, { method: 'POST', formData: fd });
      setNotice(summarise(res));
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      load();
      onChanged?.();
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async () => {
    setPasteBusy(true);
    setPasteError('');
    try {
      const res = await api(`/api/projects/${projectId}/papers/text`, {
        method: 'POST',
        body: paste,
      });
      setNotice(summarise(res));
      setPasteOpen(false);
      setPaste({ title: '', text: '' });
      load();
      onChanged?.();
    } catch (e) {
      setPasteError(e.message);
    } finally {
      setPasteBusy(false);
    }
  };

  const reanalyse = async (paper) => {
    setBusyId(paper.id);
    setNotice('');
    setError('');
    try {
      const res = await api(`/api/papers/${paper.id}/extract`, { method: 'POST' });
      setNotice(`Re-analysed "${paper.title}": ${summarise(res)}`);
      load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    setBusyId(deleteTarget.id);
    try {
      await api(`/api/papers/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UploadCloud className="h-4 w-4 text-indigo-600" />
              Upload a paper (PDF)
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Text is extracted per page so every quotation keeps its real page number. Image-only
              scanned PDFs are not supported.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="block w-full max-w-xs text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setUploadError('');
                }}
              />
              <Button onClick={handleUpload} loading={uploading} icon={UploadCloud}>
                Upload &amp; analyse
              </Button>
              <Button variant="secondary" icon={ClipboardType} onClick={() => setPasteOpen(true)}>
                Paste text instead
              </Button>
            </div>
            {uploadError ? <div className="mt-3"><ErrorBanner message={uploadError} /></div> : null}
          </div>
        </div>
        {notice ? (
          <div className="mt-3">
            <Notice tone="success">{notice}</Notice>
          </div>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {/* Paper list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-7 w-7 text-indigo-600" />
        </div>
      ) : papers.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No papers yet"
          description="Upload at least two papers to compare their constructs. You can also paste plain text with '--- Page N ---' markers."
        />
      ) : (
        <ul className="space-y-3">
          {papers.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft transition-shadow hover:shadow-card sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-inset ring-indigo-100">
                  <FileText className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/papers/${p.id}`)}
                    className="text-left font-semibold text-slate-900 hover:text-indigo-700"
                  >
                    {p.title}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {p.authors ? <span>{p.authors}</span> : null}
                    {p.year ? <span>{p.year}</span> : null}
                    <span>{p.pageCount} page{p.pageCount === 1 ? '' : 's'}</span>
                    <span>· {p.constructCount} construct{p.constructCount === 1 ? '' : 's'}</span>
                    <span>· {p.sourceType === 'pdf' ? 'PDF upload' : 'pasted text'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <StatusBadge status={p.status} />
                {p.status === 'failed' && p.error ? (
                  <Badge tone="rose" title={p.error}>error</Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  icon={RefreshCw}
                  loading={busyId === p.id}
                  onClick={() => reanalyse(p)}
                >
                  Re-run
                </Button>
                {p.hasFile ? (
                  <a href={apiUrl(`/api/papers/${p.id}/pdf`)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" icon={Download}>
                      PDF
                    </Button>
                  </a>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Trash2}
                  onClick={() => setDeleteTarget(p)}
                  className="hover:text-rose-600"
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Paste text modal */}
      <Modal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Paste paper text"
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setPasteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePaste} loading={pasteBusy} icon={CheckCircle2}>
              Add &amp; analyse
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {pasteError ? <ErrorBanner message={pasteError} /> : null}
          <Field label="Paper title">
            <Input
              value={paste.title}
              onChange={(e) => setPaste({ ...paste, title: e.target.value })}
              placeholder="e.g. Employee Wellbeing and Retention"
            />
          </Field>
          <Field
            label="Full text"
            hint="Optional page markers: '--- Page 2 ---', '[Page 2]' or form-feeds. Without markers the text counts as one page."
          >
            <TextArea
              rows={12}
              value={paste.text}
              onChange={(e) => setPaste({ ...paste, text: e.target.value })}
              placeholder={'--- Page 1 ---\nJob satisfaction is defined as an emotional state...'}
              className="font-mono text-xs"
            />
          </Field>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete paper?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={busyId === deleteTarget?.id}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Removes <strong>{deleteTarget?.title}</strong>, its extracted constructs and any
          suggestions that depend on them. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
