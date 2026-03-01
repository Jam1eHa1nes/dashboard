import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useOrg } from '../../contexts/OrgContext';

export function OrgSwitcher() {
  const { orgs, currentOrg } = useOrg();
  const { orgId }            = useParams<{ orgId: string }>();
  const navigate             = useNavigate();
  const [open, setOpen]      = useState(false);

  const activeOrg = currentOrg ?? orgs.find(o => o.id === orgId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-panel-alt transition-colors"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/20 text-accent text-xs font-bold">
          {activeOrg?.name.charAt(0).toUpperCase() ?? '?'}
        </span>
        <span className="flex-1 truncate text-left text-text font-medium">
          {activeOrg?.name ?? 'Select org'}
        </span>
        <ChevronsUpDown size={14} className="text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-panel shadow-2xl overflow-hidden">
          {orgs.map(org => (
            <button
              key={org.id}
              onClick={() => {
                navigate(`/org/${org.id}`);
                setOpen(false);
              }}
              className={clsx(
                'flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors',
                org.id === orgId
                  ? 'bg-accent/10 text-accent'
                  : 'text-text hover:bg-panel-alt'
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/20 text-accent text-xs font-bold">
                {org.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 truncate text-left">{org.name}</span>
              {org.id === orgId && <Check size={12} />}
            </button>
          ))}
          <div className="border-t border-border">
            <button
              onClick={() => { navigate('/onboarding'); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-muted hover:text-text hover:bg-panel-alt transition-colors"
            >
              <Plus size={14} />
              New organisation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
