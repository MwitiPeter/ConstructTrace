import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Boxes,
  GitCompareArrows,
  History,
  Pencil,
  Download,
  FileJson,
  Table2,
} from 'lucide-react';
import { api, apiUrl } from '../api.js';
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Modal,
  Tabs,
  TextArea,
} from '../components/ui.jsx';
import Spinner from '../components/Spinner.jsx';
import PapersTab from '../components/PapersTab.jsx';
import ConstructsTab from '../components/ConstructsTab.jsx';
import SuggestionsTab from '../components/SuggestionsTab.jsx';
import HistoryTab from '../components/HistoryTab.jsx';

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [counts, setCounts] = useState(null);
  const [tab, setTab] = useState('papers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', researchQuestion: '' });
  const [editError, setEditError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/api/projects/${id}`)
      .then((d) => {
        setProject(d.project);
        setCounts(d.counts);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [id, load]);

  const openEdit = () => {
    setForm({
      name: project.name,
      description: project.description || '',
      researchQuestion: project.researchQuestion || '',
    });
    setEditError('');
    setEditOpen(true);
  };

  const save = async () => {
    setBusy(true);
    setEditError('');
    try {
      await api(`/api/projects/${id}`, { method: 'PATCH', body: form });
      setEditOpen(false);
      load();
    } catch (e) {
      setEditError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error} onRetry={load} />
        <Link to="/projects">
          <Button variant="secondary" icon={ArrowLeft}>
            Back to projects
          </Button>
        </Link>
      </div>
    );
  }

  const tabDefs = [
    { id: 'papers', label: 'Papers', icon: FileText, count: counts?.papers },
    { id: 'constructs', label: 'Constructs', icon: Boxes, count: counts?.constructs },
    { id: 'suggestions', label: 'Suggestions', icon: GitCompareArrows, count: counts?.suggestions?.pending },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/projects"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" /> All projects
        </Link>

        <Card className="overflow-hidden p-0">
          <div className="relative border-b border-slate-100 bg-gradient-to-r from-white via-indigo-50/50 to-violet-50/50 px-5 py-5">
            <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-indigo-200/30 blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <span className="brand-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-glow">
                  {project.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                      {project.name}
                    </h1>
                    {project.status === 'archived' ? <Badge tone="slate">archived</Badge> : null}
                  </div>
                  {project.description ? (
                    <p className="mt-1 text-sm text-slate-600">{project.description}</p>
                  ) : null}
                  {project.researchQuestion ? (
                    <p className="mt-3 rounded-xl border border-indigo-100 bg-white/70 px-3 py-2 text-sm text-indigo-900 shadow-soft">
                      <span className="font-semibold">Research question:</span>{' '}
                      {project.researchQuestion}
                    </p>
                  ) : null}
                </div>
              </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" icon={Pencil} onClick={openEdit}>
                Edit
              </Button>
              <a href={apiUrl(`/api/projects/${id}/export?format=json`)}>
                <Button size="sm" variant="secondary" icon={FileJson}>
                  JSON
                </Button>
              </a>
              <a href={apiUrl(`/api/projects/${id}/export?format=csv&entity=suggestions`)}>
                <Button size="sm" variant="secondary" icon={Table2}>
                  CSV suggestions
                </Button>
              </a>
              <a href={apiUrl(`/api/projects/${id}/export?format=csv&entity=constructs`)}>
                <Button size="sm" variant="secondary" icon={Download}>
                  CSV constructs
                </Button>
              </a>
            </div>
          </div>
        </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 py-3 text-xs text-slate-500">
            <span>
              <strong className="text-slate-800">{counts?.papers ?? 0}</strong> papers
            </span>
            <span className="text-slate-300">•</span>
            <span>
              <strong className="text-slate-800">{counts?.constructs ?? 0}</strong> constructs
            </span>
            <span className="text-slate-300">•</span>
            <span>
              <strong className="text-amber-600">{counts?.suggestions?.pending ?? 0}</strong> pending
              reviews
            </span>
            <span className="text-slate-300">•</span>
            <span>
              <strong className="text-slate-800">{counts?.suggestions?.total ?? 0}</strong>{' '}
              suggestions total
            </span>
          </div>
        </Card>
      </div>

      <Tabs tabs={tabDefs} active={tab} onChange={setTab} />

      {tab === 'papers' ? <PapersTab projectId={id} onChanged={load} /> : null}
      {tab === 'constructs' ? <ConstructsTab projectId={id} /> : null}
      {tab === 'suggestions' ? <SuggestionsTab projectId={id} onChanged={load} /> : null}
      {tab === 'history' ? <HistoryTab projectId={id} /> : null}

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit project"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editError ? <ErrorBanner message={editError} /> : null}
          <Field label="Project name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Description">
            <TextArea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Research question">
            <TextArea
              rows={2}
              value={form.researchQuestion}
              onChange={(e) => setForm({ ...form, researchQuestion: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
