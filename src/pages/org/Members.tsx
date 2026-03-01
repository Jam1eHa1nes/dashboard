import { useEffect, useState } from 'react';
import { UserPlus, Trash2, Mail } from 'lucide-react';
import { supabase }            from '../../lib/supabase';
import { sendInvitation }      from '../../lib/api';
import { useAuth }             from '../../contexts/AuthContext';
import { useOrg }              from '../../contexts/OrgContext';
import { Card }                from '../../components/ui/Card';
import { Button }              from '../../components/ui/Button';
import { Input, Select }       from '../../components/ui/Input';
import { Modal }               from '../../components/ui/Modal';
import { RoleBadge }           from '../../components/ui/Badge';
import { PageSpinner }         from '../../components/ui/Spinner';
import type { OrgMember, Invitation, Role } from '../../types/supabase';
import { formatRelative, formatDate } from '../../lib/formatters';

interface MemberWithEmail extends OrgMember {
  email?: string;
}

export default function Members() {
  const { user }            = useAuth();
  const { currentOrg }      = useOrg();
  const [members,  setMembers]     = useState<MemberWithEmail[]>([]);
  const [invites,  setInvites]     = useState<Invitation[]>([]);
  const [loading,  setLoading]     = useState(true);
  const [showModal, setShowModal]  = useState(false);
  const [email,    setEmail]       = useState('');
  const [role,     setRole]        = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting]    = useState(false);
  const [inviteErr, setInviteErr]  = useState('');
  const [acceptUrl, setAcceptUrl]  = useState('');
  const isAdmin = currentOrg?.role === 'owner' || currentOrg?.role === 'admin';

  async function load() {
    if (!currentOrg) return;
    setLoading(true);

    const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabase.from('org_members').select('*').eq('org_id', currentOrg.id),
      supabase.from('invitations').select('*').eq('org_id', currentOrg.id)
        .is('accepted_at', null).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ]);

    setMembers(memberRows ?? []);
    setInvites(inviteRows ?? []);
    setLoading(false);
  }

  useEffect(() => { if (currentOrg) load(); }, [currentOrg?.id]);

  async function invite() {
    if (!currentOrg || !email.trim()) return;
    setInviting(true);
    setInviteErr('');
    try {
      const { accept_url } = await sendInvitation({ org_id: currentOrg.id, email: email.trim(), role });
      setAcceptUrl(accept_url);
      await load();
    } catch (err) {
      setInviteErr(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string) {
    if (userId === user?.id && !confirm('Remove yourself from this organisation?')) return;
    if (!currentOrg) return;
    await supabase.from('org_members').delete()
      .eq('org_id', currentOrg.id).eq('user_id', userId);
    await load();
  }

  if (loading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-semibold text-text">Members</h2>
        {isAdmin && (
          <Button icon={<UserPlus size={14} />} onClick={() => setShowModal(true)}>
            Invite member
          </Button>
        )}
      </div>

      {/* Members table */}
      <Card padding="none" className="overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['User', 'Role', 'Joined', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map(m => (
              <tr key={m.user_id} className="hover:bg-panel-alt transition-colors">
                <td className="px-5 py-3">
                  <span className="text-xs text-text font-mono">
                    {m.user_id === user?.id ? `${user.email} (you)` : m.user_id.slice(0, 8) + '…'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <RoleBadge role={(m.role ?? 'member') as Role} />
                </td>
                <td className="px-5 py-3 text-xs text-muted">{formatRelative(m.joined_at)}</td>
                <td className="px-5 py-3 text-right">
                  {isAdmin && m.role !== 'owner' && (
                    <button
                      onClick={() => removeMember(m.user_id)}
                      className="text-muted hover:text-error transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Pending invitations */}
      {invites.length > 0 && (
        <>
          <h3 className="font-heading text-sm font-semibold text-text mb-3">Pending invitations</h3>
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Email', 'Role', 'Expires'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invites.map(inv => (
                  <tr key={inv.id} className="hover:bg-panel-alt">
                    <td className="px-5 py-3 text-xs text-text flex items-center gap-2">
                      <Mail size={12} className="text-muted" />{inv.email}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">{inv.role}</td>
                    <td className="px-5 py-3 text-xs text-muted">{formatDate(inv.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Invite modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setAcceptUrl(''); setEmail(''); }} title="Invite member">
        {acceptUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-success">Invitation created!</p>
            <p className="text-xs text-muted">Share this link with <span className="text-text">{email}</span>:</p>
            <div className="rounded-lg bg-bg border border-border p-3 font-mono text-xs text-accent break-all select-all">
              {acceptUrl}
            </div>
            <Button className="w-full" onClick={() => { setShowModal(false); setAcceptUrl(''); setEmail(''); }}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@example.com" required />
            <Select
              label="Role"
              value={role}
              onChange={e => setRole(e.target.value as typeof role)}
              options={[
                { value: 'admin',  label: 'Admin — full access' },
                { value: 'member', label: 'Member — view and trigger runs' },
                { value: 'viewer', label: 'Viewer — read only' },
              ]}
            />
            {inviteErr && <p className="text-xs text-error">{inviteErr}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={invite} loading={inviting} disabled={!email.trim()}>Send invite</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
