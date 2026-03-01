import { clsx } from 'clsx';

interface Props {
  passed:  number;
  failed:  number;
  skipped: number;
  total:   number;
  height?: number;
}

export function TestResultBar({ passed, failed, skipped, total, height = 8 }: Props) {
  if (total === 0) {
    return <div className="rounded-full bg-panel-alt" style={{ height }} />;
  }

  const pPct = (passed  / total) * 100;
  const fPct = (failed  / total) * 100;
  const sPct = (skipped / total) * 100;

  return (
    <div
      className="flex overflow-hidden rounded-full"
      style={{ height }}
      title={`${passed} passed · ${failed} failed · ${skipped} skipped`}
    >
      {pPct > 0 && (
        <div className="bg-success" style={{ width: `${pPct}%` }} />
      )}
      {fPct > 0 && (
        <div className="bg-error"   style={{ width: `${fPct}%` }} />
      )}
      {sPct > 0 && (
        <div className="bg-warning" style={{ width: `${sPct}%` }} />
      )}
    </div>
  );
}

interface StatRowProps {
  passed:  number;
  failed:  number;
  skipped: number;
  total:   number;
}

export function StatRow({ passed, failed, skipped, total }: StatRowProps) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className={clsx('font-mono', failed > 0 ? 'text-error font-semibold' : 'text-muted')}>
        {failed > 0 ? `${failed} failed` : `0 failed`}
      </span>
      <span className="text-success font-mono">{passed} passed</span>
      {skipped > 0 && <span className="text-warning font-mono">{skipped} skipped</span>}
      <span className="text-muted font-mono ml-auto">{total} total</span>
    </div>
  );
}
