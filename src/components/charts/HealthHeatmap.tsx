import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import type { Project, Run } from '../../types/supabase';
import { passRate } from '../../lib/formatters';

interface ProjectWithLastRun extends Project {
  lastRun?: Run;
}

interface Props {
  projects: ProjectWithLastRun[];
  orgId:    string;
}

function cellColor(run?: Run): string {
  if (!run) return 'bg-panel-alt border-border text-muted/40';
  const rate = passRate(run.passed ?? 0, run.total ?? 0);
  if (rate >= 95) return 'bg-success/15 border-success/30 text-success';
  if (rate >= 80) return 'bg-warning/15 border-warning/30 text-warning';
  return 'bg-error/15 border-error/30 text-error';
}

export function HealthHeatmap({ projects, orgId }: Props) {
  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-8">No projects yet.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {projects.map(project => {
        const rate = project.lastRun
          ? passRate(project.lastRun.passed ?? 0, project.lastRun.total ?? 0)
          : null;

        return (
          <Link
            key={project.id}
            to={`/org/${orgId}/projects/${project.id}`}
            className={clsx(
              'flex flex-col items-center justify-center rounded-xl border p-4 gap-1 transition-opacity hover:opacity-80',
              cellColor(project.lastRun)
            )}
          >
            <span className="text-xs font-medium text-center line-clamp-2 leading-tight">
              {project.name}
            </span>
            <span className="text-lg font-bold font-mono">
              {rate != null ? `${rate}%` : '—'}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
