import { useEffect, useState } from 'react';
import { useParams }           from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase }            from '../../lib/supabase';
import { AppShell }            from '../../components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge, StateBadge }   from '../../components/ui/Badge';
import { PageSpinner }         from '../../components/ui/Spinner';
import { TestResultBar, StatRow } from '../../components/charts/TestResultBar';
import type { Run, Suite, TestResult, TestState } from '../../types/supabase';
import { formatDuration, commitShort, formatDate } from '../../lib/formatters';
import { clsx }                from 'clsx';

type Filter = 'all' | 'failed' | 'passed' | 'skipped';

interface SuiteWithTests extends Suite {
  tests: TestResult[];
}

export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const [run,    setRun]    = useState<Run | null>(null);
  const [suites, setSuites] = useState<SuiteWithTests[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!runId) return;
    async function load() {
      const [{ data: run }, { data: suitesData }, { data: tests }] = await Promise.all([
        supabase.from('runs').select('*').eq('id', runId!).single(),
        supabase.from('suites').select('*').eq('run_id', runId!).order('name'),
        supabase.from('test_results').select('*').eq('run_id', runId!).order('name'),
      ]);

      setRun(run);

      const testsBySuite = new Map<string, TestResult[]>();
      for (const t of tests ?? []) {
        if (!t.suite_id) continue;
        const arr = testsBySuite.get(t.suite_id) ?? [];
        arr.push(t);
        testsBySuite.set(t.suite_id, arr);
      }

      const withTests: SuiteWithTests[] = (suitesData ?? []).map(s => ({
        ...s,
        tests: testsBySuite.get(s.id) ?? [],
      }));

      setSuites(withTests);

      // Auto-expand suites with failures
      const failedSuiteIds = new Set(
        withTests.filter(s => (s.failed ?? 0) > 0).map(s => s.id)
      );
      setExpanded(failedSuiteIds);

      setLoading(false);
    }
    load();
  }, [runId]);

  function toggleSuite(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function filterTests(tests: TestResult[]): TestResult[] {
    if (filter === 'all') return tests;
    return tests.filter(t => t.state === filter);
  }

  if (loading || !run) return <AppShell title="Run"><PageSpinner /></AppShell>;

  const filters: { key: Filter; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'failed',  label: `Failed (${run.failed})` },
    { key: 'passed',  label: `Passed (${run.passed})` },
    { key: 'skipped', label: `Skipped (${run.skipped})` },
  ];

  return (
    <AppShell title="Run detail">
      {/* Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Run summary</CardTitle>
          <span className="text-xs text-muted">{formatDate(run.created_at)}</span>
        </CardHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Total',    value: run.total,       color: 'text-text'    },
            { label: 'Passed',   value: run.passed,      color: 'text-success' },
            { label: 'Failed',   value: run.failed,      color: 'text-error'   },
            { label: 'Skipped',  value: run.skipped,     color: 'text-warning' },
          ].map(s => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-xs text-muted">{s.label}</span>
              <span className={`text-2xl font-mono font-bold ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
        <TestResultBar
          passed={run.passed ?? 0} failed={run.failed ?? 0}
          skipped={run.skipped ?? 0} total={run.total ?? 0} height={10}
        />
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
          {run.branch     && <span>Branch: <span className="text-text font-mono">{run.branch}</span></span>}
          {run.commit_sha && <span>Commit: <span className="text-text font-mono">{commitShort(run.commit_sha)}</span></span>}
          {run.framework  && <span>Framework: <span className="text-text">{run.framework}</span></span>}
          {run.duration_ms != null && <span>Duration: <span className="text-text">{formatDuration(run.duration_ms)}</span></span>}
          {run.triggered_by && <Badge variant="muted">{run.triggered_by}</Badge>}
        </div>
        {run.commit_message && (
          <p className="mt-2 text-xs text-muted italic">"{run.commit_message}"</p>
        )}
      </Card>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === f.key
                ? 'bg-accent/15 text-accent'
                : 'text-muted hover:text-text hover:bg-panel'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Suites */}
      <div className="space-y-3">
        {suites.map(suite => {
          const visible = filterTests(suite.tests);
          if (visible.length === 0 && filter !== 'all') return null;
          const isOpen = expanded.has(suite.id);

          return (
            <Card key={suite.id} padding="none" className="overflow-hidden">
              <button
                onClick={() => toggleSuite(suite.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-panel-alt transition-colors"
              >
                {isOpen
                  ? <ChevronDown  size={14} className="text-muted shrink-0" />
                  : <ChevronRight size={14} className="text-muted shrink-0" />}
                <span className="flex-1 text-left text-sm font-medium text-text truncate">
                  {suite.name}
                </span>
                <StatRow
                  passed={suite.passed ?? 0} failed={suite.failed ?? 0}
                  skipped={suite.skipped ?? 0} total={suite.total ?? 0}
                />
                {suite.duration_ms != null && (
                  <span className="text-xs text-muted shrink-0 ml-4">
                    {formatDuration(suite.duration_ms)}
                  </span>
                )}
              </button>

              {isOpen && visible.length > 0 && (
                <div className="border-t border-border divide-y divide-border">
                  {visible.map(test => (
                    <div key={test.id} className="px-5 py-3">
                      <div className="flex items-start gap-3">
                        <StateBadge state={(test.state ?? 'pending') as TestState} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text break-words">
                            {test.full_name ?? test.name}
                          </p>
                          {test.duration_ms != null && (
                            <p className="text-[10px] text-muted mt-0.5">
                              {formatDuration(test.duration_ms)}
                              {(test.retry_count ?? 0) > 0 && ` · ${test.retry_count} retries`}
                            </p>
                          )}
                          {test.error_message && (
                            <p className="mt-2 text-xs text-error">{test.error_message}</p>
                          )}
                          {test.error_stack && (
                            <pre className="mt-2 p-3 rounded-lg bg-bg border border-error/20 text-[10px] text-muted overflow-x-auto whitespace-pre-wrap leading-relaxed">
                              {test.error_stack}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
