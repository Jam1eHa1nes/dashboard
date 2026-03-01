import { useEffect, useState } from 'react';
import { useParams }           from 'react-router-dom';
import { Plus, Trash2, Key }   from 'lucide-react';
import { supabase }            from '../../lib/supabase';
import { useOrg }              from '../../contexts/OrgContext';
import { AppShell }            from '../../components/layout/AppShell';
import { Card }                from '../../components/ui/Card';
import { Button }              from '../../components/ui/Button';
import { Input }               from '../../components/ui/Input';
import { Modal }               from '../../components/ui/Modal';
import { PageSpinner }         from '../../components/ui/Spinner';
import type { ApiKey }         from '../../types/supabase';
import { formatRelative }      from '../../lib/formatters';

function generateApiKey(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `qac_${rand}`;
}

async function sha256Hex(s: string): Promise<string> {
  const encoder = new TextEncoder();
  const data    = encoder.encode(s);
  const buf     = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ApiKeys() {
  const { projectId } = useParams<{ orgId: string; projectId: string }>();
  const { currentOrg }      = useOrg();
  const [keys,    setKeys]   = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [label,    setLabel]    = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey,   setNewKey]   = useState<string | null>(null);

  async function loadKeys() {
    if (!projectId) return;
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    setKeys(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadKeys(); }, [projectId]);

  async function createKey() {
    if (!currentOrg || !projectId) return;
    setCreating(true);
    const rawKey    = generateApiKey();
    const keyHash   = await sha256Hex(rawKey);
    const keyPrefix = rawKey.slice(0, 8);

    const { error } = await supabase.from('api_keys').insert({
      project_id: projectId,
      org_id:     currentOrg.id,
      key_hash:   keyHash,
      key_prefix: keyPrefix,
      label:      label.trim() || null,
    });

    if (!error) {
      setNewKey(rawKey);
      await loadKeys();
    }
    setCreating(false);
  }

  async function deleteKey(id: string) {
    if (!confirm('Delete this API key? Any CI pipelines using it will stop working.')) return;
    await supabase.from('api_keys').delete().eq('id', id);
    await loadKeys();
  }

  if (loading) return <AppShell title="API Keys"><PageSpinner /></AppShell>;

  return (
    <AppShell title="API Keys">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-semibold text-text">API Keys</h2>
        <Button icon={<Plus size={14} />} onClick={() => setShowModal(true)}>
          New key
        </Button>
      </div>

      <Card padding="none" className="overflow-hidden">
        {keys.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-center">
            <Key size={32} className="text-muted/30" />
            <p className="text-sm text-muted">No API keys yet. Create one to start ingesting reports.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Prefix', 'Label', 'Last used', 'Created', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.map(k => (
                <tr key={k.id} className="hover:bg-panel-alt transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-accent">{k.key_prefix}••••••••</td>
                  <td className="px-5 py-3 text-xs text-muted">{k.label ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-muted">{formatRelative(k.last_used_at)}</td>
                  <td className="px-5 py-3 text-xs text-muted">{formatRelative(k.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => deleteKey(k.id)} className="text-muted hover:text-error transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Create key modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setNewKey(null); setLabel(''); }} title="New API key">
        {newKey ? (
          <div className="space-y-4">
            <p className="text-sm text-warning">
              Copy this key now — it won't be shown again.
            </p>
            <div className="rounded-lg bg-bg border border-border p-4 font-mono text-xs text-accent break-all select-all">
              {newKey}
            </div>
            <p className="text-xs text-muted">
              Add this as <code className="text-accent">QA_PROJECT_KEY</code> in your GitHub repository secrets.
            </p>
            <Button
              className="w-full"
              onClick={() => { setShowModal(false); setNewKey(null); setLabel(''); }}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Label (optional)"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. CI / Production"
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={createKey} loading={creating}>Create key</Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
