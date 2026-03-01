import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate }          from 'react-router-dom';
import { Link }                            from 'react-router-dom';
import { Key, Copy, Check, ExternalLink }  from 'lucide-react';
import { supabase }                        from '../../lib/supabase';
import { useOrg }                          from '../../contexts/OrgContext';
import { useRuns }                         from '../../hooks/useRuns';
import { useRealtimeRuns }                 from '../../hooks/useRealtime';
import { useToast }                        from '../../hooks/useToast';
import { AppShell }                        from '../../components/layout/AppShell';
import { Card, CardHeader, CardTitle }     from '../../components/ui/Card';
import { PassRateTrend }                   from '../../components/charts/PassRateTrend';
import { TestResultBar, StatRow }          from '../../components/charts/TestResultBar';
import { ToastContainer }                  from '../../components/ui/Toast';
import { PageSpinner }                     from '../../components/ui/Spinner';
import { Empty }                           from '../../components/ui/Empty';
import { Badge }                           from '../../components/ui/Badge';
import type { Project, ApiKey, Run }       from '../../types/supabase';
import { formatRelative, formatDuration, commitShort } from '../../lib/formatters';

export default function ProjectDetail() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { currentOrg }      = useOrg();
  const navigate             = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [apiKeys,  setApiKeys] = useState<ApiKey[]>([]);
  const [flaky,    setFlaky]   = useState<{ name: string; passes: number; fails: number }[]>([]);
  const [copied,   setCopied]  = useState(false);
  const { runs, loading, prependRun } = useRuns(projectId);
  const { toasts, addToast, removeToast } = useToast();

  const isAdmin = currentOrg?.role === 'owner' || currentOrg?.role === 'admin';

  useEffect(() => {
    if (!projectId) return;
    supabase.from('projects').select('*').eq('id', projectId).single()
      .then(({ data }) => setProject(data));
    if (isAdmin) {
      supabase.from('api_keys').select('*').eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .then(({ data }) => setApiKeys(data ?? []));
    }
  }, [projectId, isAdmin]);

  // Flakiness analysis: tests that have both passed and failed in last 20 runs
  const loadFlaky = useCallback(async () => {
    if (!projectId || runs.length === 0) return;
    const runIds = runs.slice(0, 20).map(r => r.id);
    const { data } = await supabase
      .from('test_results')
      .select('name, state')
      .in('run_id', runIds);

    if (!data) return;

    const byName = new Map<string, { passes: number; fails: number }>();
    for (const t of data) {
      const entry = byName.get(t.name) ?? { passes: 0, fails: 0 };
      if (t.state === 'passed') entry.passes++;
      if (t.state === 'failed') entry.fails++;
      byName.set(t.name, entry);
    }

    const flaky = [...byName.entries()]
      .filter(([, v]) => v.passes > 0 && v.fails > 0)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.fails - a.fails)
      .slice(0, 10);

    setFlaky(flaky);
  }, [projectId, runs]);

  useEffect(() => { loadFlaky(); }, [loadFlaky]);

  // Realtime: new run notification
  useRealtimeRuns(projectId, (run: Run) => {
    prependRun(run);
    addToast(
      `New run: ${(run.failed ?? 0) > 0 ? `${run.failed} failed` : 'All passed'} · ${run.total} tests`,
      (run.failed ?? 0) > 0 ? 'error' : 'success'
    );
  });

  async function copyEndpoint() {
    const url = `${window.location.origin}/api/reports`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading || !project) return <AppShell title="Project"><PageSpinner /></AppShell>;

  return (
    <AppShell title={project.name}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="space-y-6">
        {/* Pass rate trend */}
        <Card>
          <CardHeader>
            <CardTitle>Pass rate — last 30 runs</CardTitle>
            <span className="text-xs text-muted">{runs.length} runs</span>
          </CardHeader>
          <PassRateTrend runs={runs} />
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Run history */}
          <div className="lg:col-span-2">
            <Card padding="none" className="overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <CardTitle>Run history</CardTitle>
              </div>
              {runs.length === 0 ? (
                <Empty title="No runs yet" description="Push test results to see them here." />
              ) : (
                <div className="divide-y divide-border">
                  {runs.map(run => (
                    <button
                      key={run.id}
                      onClick={() => navigate(`/org/${orgId}/projects/${projectId}/runs/${run.id}`)}
                      className="w-full flex flex-col gap-2 px-5 py-4 hover:bg-panel-alt transition-colors text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {run.branch && (
                            <Badge variant="muted">{run.branch}</Badge>
                          )}
                          {run.commit_sha && (
                            <span className="text-xs text-muted font-mono">
                              {commitShort(run.commit_sha)}
                            </span>
                          )}
                          {run.triggered_by && (
                            <Badge variant={run.triggered_by === 'ci' ? 'info' : 'muted'}>
                              {run.triggered_by}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted shrink-0">
                          {formatRelative(run.created_at)}
                        </span>
                      </div>
                      <TestResultBar
                        passed={run.passed ?? 0} failed={run.failed ?? 0}
                        skipped={run.skipped ?? 0} total={run.total ?? 0} height={6}
                      />
                      <StatRow
                        passed={run.passed ?? 0} failed={run.failed ?? 0}
                        skipped={run.skipped ?? 0} total={run.total ?? 0}
                      />
                      {run.duration_ms != null && (
                        <span className="text-[10px] text-muted">
                          {formatDuration(run.duration_ms)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Flakiness */}
            <Card padding="none" className="overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <CardTitle>Flaky tests</CardTitle>
              </div>
              {flaky.length === 0 ? (
                <p className="px-5 py-6 text-xs text-muted text-center">No flaky tests detected</p>
              ) : (
                <div className="divide-y divide-border">
                  {flaky.map(t => (
                    <div key={t.name} className="px-5 py-3">
                      <p className="text-xs text-text font-mono truncate" title={t.name}>{t.name}</p>
                      <p className="text-[10px] text-muted mt-0.5">
                        <span className="text-success">{t.passes} pass</span>
                        {' · '}
                        <span className="text-error">{t.fails} fail</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* API Keys */}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>API endpoint</CardTitle>
                  <button onClick={copyEndpoint} className="text-muted hover:text-accent transition-colors">
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  </button>
                </CardHeader>
                <p className="text-xs text-muted mb-3">
                  POST test results to this endpoint with your API key.
                </p>
                <div className="rounded-lg bg-bg border border-border p-3 font-mono text-xs text-accent break-all">
                  {window.location.origin}/api/reports
                </div>

                <div className="mt-4 space-y-2">
                  {apiKeys.length === 0 ? (
                    <p className="text-xs text-muted">No API keys yet.</p>
                  ) : (
                    apiKeys.map(key => (
                      <div key={key.id} className="flex items-center gap-2 text-xs">
                        <Key size={12} className="text-muted shrink-0" />
                        <span className="font-mono text-muted">{key.key_prefix}••••••••</span>
                        {key.label && <span className="text-muted/60">{key.label}</span>}
                      </div>
                    ))
                  )}
                </div>

                <Link
                  to={`/org/${orgId}/projects/${projectId}/api-keys`}
                  className="mt-4 flex items-center gap-1.5 text-xs text-accent hover:opacity-80 transition-opacity"
                >
                  <ExternalLink size={12} />
                  Manage API keys
                </Link>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
