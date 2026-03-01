import { useEffect, useState } from 'react';
import { Link, useParams }     from 'react-router-dom';
import { supabase }            from '../../lib/supabase';
import { useOrg }              from '../../contexts/OrgContext';
import { useProjects }         from '../../hooks/useProjects';
import { AppShell }            from '../../components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { HealthHeatmap }       from '../../components/charts/HealthHeatmap';
import { PassRateTrend }       from '../../components/charts/PassRateTrend';
import { PageSpinner }         from '../../components/ui/Spinner';
import type { Run, Project }   from '../../types/supabase';
import { formatRelative, passRate } from '../../lib/formatters';
import { TestResultBar }       from '../../components/charts/TestResultBar';
import { Activity, TrendingUp, AlertCircle, BarChart2 } from 'lucide-react';

interface ProjectWithLastRun extends Project {
  lastRun?: Run;
}

export default function OrgOverview() {
  const { orgId }          = useParams<{ orgId: string }>();
  const { currentOrg, setCurrentOrgById, orgs } = useOrg();
  const { projects, loading: projLoading } = useProjects(currentOrg?.id);
  const [projectsWithRuns, setProjectsWithRuns] = useState<ProjectWithLastRun[]>([]);
  const [recentRuns,  setRecentRuns]  = useState<(Run & { project_name: string })[]>([]);
  const [trendRuns,   setTrendRuns]   = useState<Run[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (orgId) setCurrentOrgById(orgId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, orgs]);

  useEffect(() => {
    if (projLoading || !currentOrg) return;

    async function load() {
      setDataLoading(true);
      try {
        if (projects.length === 0) { setDataLoading(false); return; }

        const projectIds = projects.map(p => p.id);

        // Last run per project
        const { data: lastRuns } = await supabase
          .from('runs')
          .select('*')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false });

        const lastRunByProject = new Map<string, Run>();
        for (const run of lastRuns ?? []) {
          if (!run.project_id) continue;
          if (!lastRunByProject.has(run.project_id)) {
            lastRunByProject.set(run.project_id, run);
          }
        }

        setProjectsWithRuns(
          projects.map(p => ({ ...p, lastRun: lastRunByProject.get(p.id) }))
        );

        // Recent 10 runs across all projects with project name
        const projectNameMap = new Map(projects.map(p => [p.id, p.name]));
        const recent = (lastRuns ?? [])
          .slice(0, 10)
          .map(r => ({ ...r, project_name: projectNameMap.get(r.project_id ?? '') ?? '—' }));
        setRecentRuns(recent);

        // Last 7 days trend (up to 50 runs aggregated)
        const since = new Date();
        since.setDate(since.getDate() - 7);
        const { data: trend } = await supabase
          .from('runs')
          .select('*')
          .in('project_id', projectIds)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: true })
          .limit(50);
        setTrendRuns(trend ?? []);
      } finally {
        setDataLoading(false);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, projLoading, currentOrg]);

  if (projLoading || dataLoading) return <AppShell title="Overview"><PageSpinner /></AppShell>;

  // Quick stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekRuns = trendRuns.filter(r => new Date(r.created_at ?? '') >= weekAgo);
  const totalWeek = weekRuns.length;
  const overallPassed = weekRuns.reduce((s, r) => s + (r.passed ?? 0), 0);
  const overallTotal  = weekRuns.reduce((s, r) => s + (r.total  ?? 0), 0);
  const overallRate   = passRate(overallPassed, overallTotal);

  const mostFailing = [...projects].sort((a, b) => {
    const ar = projectsWithRuns.find(p => p.id === a.id);
    const br = projectsWithRuns.find(p => p.id === b.id);
    const af = ar?.lastRun?.failed ?? 0;
    const bf = br?.lastRun?.failed ?? 0;
    return bf - af;
  })[0];

  return (
    <AppShell title="Overview">
      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Runs this week', value: totalWeek, icon: <Activity size={14} /> },
          { label: 'Overall pass rate', value: `${overallRate}%`, icon: <TrendingUp size={14} /> },
          { label: 'Projects', value: projects.length, icon: <BarChart2 size={14} /> },
          { label: 'Most failing', value: mostFailing?.name ?? '—', icon: <AlertCircle size={14} />, small: true },
        ].map(stat => (
          <Card key={stat.label} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              {stat.icon}{stat.label}
            </div>
            <p className={`font-mono font-bold ${stat.small ? 'text-base truncate' : 'text-2xl'} text-text`}>
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health heatmap — 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <Card padding="md">
            <CardHeader>
              <CardTitle>Project health</CardTitle>
              <span className="text-xs text-muted">Last run pass rate</span>
            </CardHeader>
            <HealthHeatmap projects={projectsWithRuns} orgId={orgId!} />
          </Card>

          <Card padding="md">
            <CardHeader>
              <CardTitle>7-day trend</CardTitle>
            </CardHeader>
            <PassRateTrend runs={trendRuns} />
          </Card>
        </div>

        {/* Activity feed — 1/3 width */}
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <CardTitle>Recent activity</CardTitle>
          </div>
          <div className="divide-y divide-border">
            {recentRuns.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted text-center">No runs yet</p>
            )}
            {recentRuns.map(run => (
              <Link
                key={run.id}
                to={`/org/${orgId}/projects/${run.project_id}/runs/${run.id}`}
                className="flex flex-col gap-1.5 px-5 py-3 hover:bg-panel-alt transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text truncate max-w-[130px]">
                    {run.project_name}
                  </span>
                  <span className="text-[10px] text-muted">{formatRelative(run.created_at)}</span>
                </div>
                <TestResultBar
                  passed={run.passed ?? 0} failed={run.failed ?? 0}
                  skipped={run.skipped ?? 0} total={run.total ?? 0} height={4}
                />
                <p className="text-[10px] text-muted">
                  {(run.failed ?? 0) > 0
                    ? <span className="text-error">{run.failed} failed</span>
                    : <span className="text-success">All passed</span>
                  } · {run.total} total
                </p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
