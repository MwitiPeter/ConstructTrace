import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Pencil, Trash2, ArrowRight, SearchX } from 'lucide-react';
import { api } from '../api.js';
import {
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  TextArea,
  Modal,
  Badge,
} from '../components/ui.jsx';
import Spinner from '../components/Spinner.jsx';

const EMPTY_FORM = { name: '', description: '', researchQuestion: '' };

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | project (edit)
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const load = () => {
    setLoading(true);
    api('/api/projects')
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModal('create');
  };

  const openEdit = (p) => {
    setForm({
      name: p.name,
      description: p.description || '',
      researchQuestion: p.researchQuestion || '',
    });
    setFormError('');
    setModal(p);
  };

  const save = async () => {
    setBusy(true);
    setFormError('');
    try {
      if (modal === 'create') {
        await api('/api/projects', { method: 'POST', body: form });
      } else {
        await api(`/api/projects/${modal._id || modal.id}`, { method: 'PATCH', body: form });
      }
      setModal(null);
      load();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/api/projects/${toDelete._id || toDelete.id}`, { method: 'DELETE' });
      setToDelete(null);
      load();
    } catch (e) {
      setError(e.message);
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !projects.length) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Research projects</h1>
          <p className="text-sm text-slate-500">
            Each project groups papers, extracted constructs and review decisions.
          </p>
        </div>
        <Button icon={Plus} onClick={openCreate}>
          New project
        </Button>
      </div>

      {error ? <ErrorBanner message={error} onRetry={load} /> : null}

      {projects.length === 0 && !loading ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project, then upload the PDFs (or paste the text) of the papers you want to compare."
          action={
            <Button icon={Plus} onClick={openCreate}>
              Create your first project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p, idx) => (
            <Card
              key={p._id}
              className="animate-fade-up flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lift"
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="brand-gradient flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-soft">
                  <FolderKanban className="h-5 w-5" />
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Edit project"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(p)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Delete project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/projects/${p._id}`)}
                className="mt-3 text-left"
              >
                <h2 className="font-semibold tracking-tight text-slate-900 transition group-hover:text-indigo-700 hover:text-indigo-700">
                  {p.name}
                </h2>
              </button>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-slate-500">
                {p.description || 'No description.'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="sky">{p.counts?.papers ?? 0} papers</Badge>
                <Badge tone="violet">{p.counts?.constructs ?? 0} constructs</Badge>
                {(p.counts?.suggestions?.pending ?? 0) > 0 ? (
                  <Badge tone="amber">{p.counts.suggestions.pending} pending</Badge>
                ) : null}
                {p.status === 'archived' ? <Badge tone="slate">archived</Badge> : null}
              </div>

              <Link
                to={`/projects/${p._id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 transition group-hover:gap-2.5 hover:text-indigo-800"
              >
                Open project <ArrowRight className="h-4 w-4" />
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'New research project' : 'Edit project'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {modal === 'create' ? 'Create project' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <ErrorBanner message={formError} /> : null}
          <Field label="Project name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Remote Work & Employee Wellbeing"
              autoFocus
            />
          </Field>
          <Field label="Description">
            <TextArea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this review about?"
            />
          </Field>
          <Field label="Research question" hint="Shown on the project page to keep analysis focused.">
            <TextArea
              rows={2}
              value={form.researchQuestion}
              onChange={(e) => setForm({ ...form, researchQuestion: e.target.value })}
              placeholder="Do the papers measure the same constructs under the same names?"
            />
          </Field>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Delete project?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={busy}>
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50">
            <Trash2 className="h-4 w-4 text-rose-600" />
          </span>
          <p className="text-sm text-slate-600">
            This permanently removes <strong>{toDelete?.name}</strong> together with its uploaded
            papers, extracted constructs, suggestions and decision history. This cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
}
