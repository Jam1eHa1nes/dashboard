import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { Toast as ToastType, ToastVariant } from '../../hooks/useToast';

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-success" />,
  error:   <XCircle      size={16} className="text-error"   />,
  warning: <AlertTriangle size={16} className="text-warning" />,
  info:    <Info          size={16} className="text-accent"  />,
};

const borderClasses: Record<ToastVariant, string> = {
  success: 'border-success/30',
  error:   'border-error/30',
  warning: 'border-warning/30',
  info:    'border-accent/30',
};

interface ToastItemProps {
  toast:    ToastType;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  return (
    <div className={clsx(
      'flex items-start gap-3 rounded-xl border bg-panel px-4 py-3 shadow-xl',
      'animate-in slide-in-from-right duration-200 min-w-[300px] max-w-[400px]',
      borderClasses[toast.variant]
    )}>
      <span className="mt-0.5 shrink-0">{icons[toast.variant]}</span>
      <p className="text-sm text-text flex-1">{toast.message}</p>
      <button onClick={() => onRemove(toast.id)} className="text-muted hover:text-text">
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts:   ToastType[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
}
