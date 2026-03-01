import { LogOut, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="fixed left-56 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/90 backdrop-blur-sm px-6">
      {title && (
        <h1 className="text-sm font-semibold text-text font-heading">{title}</h1>
      )}
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <User size={14} />
          <span className="hidden sm:inline">{user?.email}</span>
        </div>
        <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
