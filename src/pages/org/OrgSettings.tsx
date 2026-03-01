import { NavLink, Outlet, useParams } from 'react-router-dom';
import { clsx }        from 'clsx';
import { AppShell }    from '../../components/layout/AppShell';

const tabs = [
  { to: '',        label: 'General' },
  { to: 'members', label: 'Members' },
];

export default function OrgSettings() {
  const { orgId } = useParams<{ orgId: string }>();
  const base      = `/org/${orgId}/settings`;

  return (
    <AppShell title="Settings">
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to ? `${base}/${tab.to}` : base}
            end={!tab.to}
            className={({ isActive }) => clsx(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-text'
            )}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </AppShell>
  );
}
