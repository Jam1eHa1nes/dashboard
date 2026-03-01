import { useEffect, useState } from 'react';
import { supabase }            from '../../lib/supabase';
import { useOrg }              from '../../contexts/OrgContext';
import { AppShell }            from '../../components/layout/AppShell';
import { Card }                from '../../components/ui/Card';
import { Input, Select }       from '../../components/ui/Input';
import { Button }              from '../../components/ui/Button';
import { PageSpinner }         from '../../components/ui/Spinner';
import { Empty }               from '../../components/ui/Empty';
import type { AuditLog as AuditLogType } from '../../types/supabase';
import { formatDate }          from '../../lib/formatters';
import { ScrollText }          from 'lucide-react';

const PAGE_SIZE = 25;

const ACTION_OPTIONS = [
  { value: '',                label: 'All actions'        },
  { value: 'ingest_report',   label: 'Ingest report'      },
  { value: 'invite_member',   label: 'Invite member'      },
  { value: 'accept_invitation', label: 'Accept invitation' },
];

export default function AuditLog() {
  const { currentOrg }   = useOrg();
  const [logs,   setLogs] = useState<AuditLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,   setPage]    = useState(0);
  const [total,  setTotal]   = useState(0);
  const [action, setAction]  = useState('');
  const [from,   setFrom]    = useState('');
  const [to,     setTo]      = useState('');

  async function load() {
    if (!currentOrg) return;
    setLoading(true);

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('org_id', currentOrg.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (action) query = query.eq('action', action);
    if (from)   query = query.gte('created_at', new Date(from).toISOString());
    if (to)     query = query.lte('created_at', new Date(to + 'T23:59:59').toISOString());

    const { data, count } = await query;
    setLogs(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }

  useEffect(() => { load(); }, [currentOrg?.id, page, action, from, to]);

  if (!currentOrg) return <AppShell title="Audit Log"><PageSpinner /></AppShell>;

  return (
    <AppShell title="Audit Log">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <Select
          label="Action"
          value={action}
          onChange={e => { setAction(e.target.value); setPage(0); }}
          options={ACTION_OPTIONS}
          className="w-48"
        />
        <Input label="From" type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0); }} />
        <Input label="To"   type="date" value={to}   onChange={e => { setTo(e.target.value);   setPage(0); }} />
        {(action || from || to) && (
          <Button variant="ghost" size="sm" onClick={() => { setAction(''); setFrom(''); setTo(''); setPage(0); }}>
            Clear
          </Button>
        )}
      </div>

      {loading ? <PageSpinner /> : logs.length === 0 ? (
        <Empty icon={<ScrollText size={40} />} title="No audit events" description="Events will appear here as users take actions." />
      ) : (
        <>
          <Card padding="none" className="overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Time', 'User', 'Action', 'Details'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-panel-alt transition-colors">
                    <td className="px-5 py-3 text-xs text-muted whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted font-mono">
                      {log.user_id ? log.user_id.slice(0, 8) + '…' : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono bg-accent/10 text-accent px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted font-mono max-w-xs truncate">
                      {JSON.stringify(log.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
