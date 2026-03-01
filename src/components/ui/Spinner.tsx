import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface SpinnerProps {
  size?:      'sm' | 'md' | 'lg';
  className?: string;
  label?:     string;
}

const sizeMap = { sm: 16, md: 24, lg: 36 };

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3', className)}>
      <Loader2 size={sizeMap[size]} className="animate-spin text-accent" />
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
