import { useEffect, useState } from 'react';
import { Link, useParams }     from 'react-router-dom';
import { Plus, FolderOpen }    from 'lucide-react';
import { supabase }            from '../../lib/supabase';
import { useOrg }              from '../../contexts/OrgContext';
import { useProjects }         from '../../hooks/useProjects';
import { AppShell }            from '../../components/layout/AppShell';
import { Card }                from '../../components/ui/Card';
import { Button }              from '../../components/ui/Button';
import { Modal }               from '../../components/ui/Modal';
import { Input }               from '../../components/ui/Input';
import { Empty }               from '../../components/ui/Empty';
import { PageSpinner }         from '../../components/ui/Spinner';
import { TestResultBar }       from '../../components/charts/TestResultBar';
import type { Run }            from '../../types/supabase';
import { formatRelative, passRate } from '../../lib/formatters';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function ProjectList() {
  const { orgId }      = useParams<{ orgId: string }>();
  const { currentOrg, setCurrentOrgById, orgs } = useOrg();
  const { projects, loading, refresh } = useProjects(currentOrg?.id);
  const [lastRuns, setLastRuns]  = useState<Record<string, Run>>({});
  const [showModal, setShowModal] = useState(false);
  const [name,     setName]      = useState('');
  const [desc,     setDesc]      = useState('');
  const [creating, setCreating]  = useState(false);
  const [createErr, setCreateErr] = useState('');
  const isAdmin = currentOrg?.role === 'owner' || currentOrg?.role === 'admin';

  useEffect(() => {
    if (orgId) setCurrentOrgById(orgId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, orgs]);

  useEffect(() => {
    if (projects.length === 0) return;
    const ids = projects.map(p => p.id);
    supabase
      .from('runs')
      .select('*')
      .in('project_id', ids)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const map: Record<string, Run> = {};
        for (const r of data ?? []) {
          if (!r.project_id) continue;
          if (!map[r.project_id]) map[r.project_id] = r;
        }
        setLastRuns(map);
      });
  }, [projects]);

  async function createProject() {
    if (!currentOrg || !name.trim()) return;
    setCreating(true);
    setCreateErr('');
    const { error } = await supabase.from('projects').insert({
      org_id:      currentOrg.id,
      name:        name.trim(),
      slug:        slugify(name),
      description: desc.trim() || null,
    });
    if (error) { setCreateErr(error.message); setCreating(false); return; }
    await refresh();
    setShowModal(false);
    setName('');
    setDesc('');
    setCreating(false);
  }

  if (loading) return <AppShell title="Projects"><PageSpinner /></AppShell>;

  return (
    <AppShell title="Projects">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-semibold text-text">Projects</h2>
        {isAdmin && (
          <Button icon={<Plus size={14} />} onClick={() => setShowModal(true)}>
            New project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <Empty
          title="No projects yet"
          description="Create your first project to start tracking test results."
          action={isAdmin && (
            <Button icon={<Plus size={14} />} onClick={() => setShowModal(true)}>
              New project
            </Button>
          )}
          icon={<FolderOpen size={48} />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => {
            const run  = lastRuns[project.id];
            const rate = run ? passRate(run.passed ?? 0, run.total ?? 0) : null;
            return (
              <Link key={project.id} to={`/org/${orgId}/projects/${project.id}`}>
                <Card className="h-full hover:border-accent/40 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-text text-sm">{project.name}</h3>
                    {rate != null && (
                      <span className={`text-xs font-mono font-bold ${
                        rate >= 95 ? 'text-success' : rate >= 80 ? 'text-warning' : 'text-error'
                      }`}>
                        {rate}%
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted mb-3 line-clamp-2">{project.description}</p>
                  )}
                  {run ? (
                    <>
                      <TestResultBar
                        passed={run.passed ?? 0} failed={run.failed ?? 0}
                        skipped={run.skipped ?? 0} total={run.total ?? 0}
                      />
                      <p className="text-[10px] text-muted mt-2">
                        Last run {formatRelative(run.created_at)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted/50">No runs yet</p>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New project">
        <div className="space-y-4">
          <Input
            label="Project name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Service"
            required
            autoFocus
          />
          <Input
            label="Description (optional)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Short description"
          />
          {createErr && <p className="text-xs text-error">{createErr}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={createProject} loading={creating} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
