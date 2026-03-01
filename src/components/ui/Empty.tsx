import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface EmptyProps {
  icon?:        ReactNode;
  title:        string;
  description?: string;
  action?:      ReactNode;
  className?:   string;
}

export function Empty({ icon, title, description, action, className }: EmptyProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 text-center gap-3', className)}>
      {icon && <div className="text-muted/40 mb-1">{icon}</div>}
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="text-xs text-muted max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
