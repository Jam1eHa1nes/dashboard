import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, Settings, ScrollText, Cpu, ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { OrgSwitcher } from './OrgSwitcher';
import { useOrg } from '../../contexts/OrgContext';

interface NavItem {
  to:       string;
  label:    string;
  icon:     React.ReactNode;
  adminOnly?: boolean;
}

export function Sidebar() {
  const { orgId }         = useParams<{ orgId: string }>();
  const { currentOrg }    = useOrg();
  const role              = currentOrg?.role;
  const isAdmin           = role === 'owner' || role === 'admin';

  const items: NavItem[] = [
    { to: `/org/${orgId}`,               label: 'Overview',    icon: <LayoutDashboard size={16} /> },
    { to: `/org/${orgId}/projects`,       label: 'Projects',    icon: <FolderKanban    size={16} /> },
    { to: `/org/${orgId}/generate`,       label: 'Generator',   icon: <Cpu             size={16} /> },
    { to: `/org/${orgId}/audit-log`,      label: 'Audit Log',   icon: <ScrollText      size={16} />, adminOnly: true },
    { to: `/org/${orgId}/settings`,       label: 'Settings',    icon: <Settings        size={16} />, adminOnly: true },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-border bg-panel">
      {/* Logo */}
      <div className="flex h-14 items-center px-5 border-b border-border">
        <span className="font-heading text-lg font-bold text-accent tracking-tight">QACore</span>
      </div>

      {/* Org switcher */}
      <div className="border-b border-border px-3 py-2">
        <OrgSwitcher />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {items.map(item => {
          if (item.adminOnly && !isAdmin) return null;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === `/org/${orgId}`}
              className={({ isActive }) => clsx(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-100',
                isActive
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-muted hover:text-text hover:bg-panel-alt'
              )}
            >
              {item.icon}
              {item.label}
              {false && <ChevronRight size={12} className="ml-auto" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-3">
        <p className="text-[10px] text-muted/50 text-center">QACore v1.0</p>
      </div>
    </aside>
  );
}
