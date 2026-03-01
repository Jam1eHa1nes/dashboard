import { clsx } from 'clsx';
import type { Role, TestState } from '../../types/supabase';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'muted' | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success/15 text-success border-success/30',
  error:   'bg-error/15   text-error   border-error/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  info:    'bg-accent/15  text-accent  border-accent/30',
  muted:   'bg-panel      text-muted   border-border',
  accent:  'bg-accent/20  text-accent  border-accent/40',
};

export function Badge({ variant = 'muted', children, className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  );
}

// Convenience wrappers
export function RoleBadge({ role }: { role: Role }) {
  const map: Record<Role, BadgeVariant> = {
    owner:  'accent',
    admin:  'info',
    member: 'muted',
    viewer: 'muted',
  };
  return <Badge variant={map[role]}>{role}</Badge>;
}

export function StateBadge({ state }: { state: TestState }) {
  const map: Record<TestState, BadgeVariant> = {
    passed:  'success',
    failed:  'error',
    skipped: 'warning',
    pending: 'muted',
  };
  return <Badge variant={map[state]}>{state}</Badge>;
}
