/**
 * Display formatting utilities.
 */

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000)  return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(secs  / 60);
  const hours = Math.floor(mins  / 60);
  const days  = Math.floor(hours / 24);

  if (secs  < 60)   return `${secs}s ago`;
  if (mins  < 60)   return `${mins}m ago`;
  if (hours < 24)   return `${hours}h ago`;
  if (days  < 7)    return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day:    'numeric',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export function passRate(passed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((passed / total) * 100);
}

export function passRateColor(rate: number): string {
  if (rate >= 95) return 'text-success';
  if (rate >= 80) return 'text-warning';
  return 'text-error';
}

export function passRateBg(rate: number): string {
  if (rate >= 95) return 'bg-success/20 border-success/30';
  if (rate >= 80) return 'bg-warning/20 border-warning/30';
  return 'bg-error/20 border-error/30';
}

export function commitShort(sha: string | null | undefined): string {
  if (!sha) return '—';
  return sha.slice(0, 7);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
