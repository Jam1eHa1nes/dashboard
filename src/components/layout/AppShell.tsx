import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar }  from './TopBar';

interface AppShellProps {
  children: ReactNode;
  title?:   string;
}

export function AppShell({ children, title }: AppShellProps) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <Sidebar />
      <TopBar title={title} />
      <main className="pl-56 pt-14">
        <div className="mx-auto max-w-7xl px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
