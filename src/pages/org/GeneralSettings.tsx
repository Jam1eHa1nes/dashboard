import { useState } from 'react';
import { supabase }  from '../../lib/supabase';
import { useOrg }    from '../../contexts/OrgContext';
import { Button }    from '../../components/ui/Button';
import { Input }     from '../../components/ui/Input';

export default function GeneralSettings() {
  const { currentOrg, refresh } = useOrg();
  const [name,    setName]    = useState(currentOrg?.name ?? '');
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrg) return;
    setSaving(true);
    setError('');

    const { error } = await supabase
      .from('organisations')
      .update({ name: name.trim() })
      .eq('id', currentOrg.id);

    if (error) { setError(error.message); }
    else       { await refresh(); setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    setSaving(false);
  }

  return (
    <div className="max-w-md">
      <h3 className="font-heading text-base font-semibold text-text mb-6">Organisation settings</h3>
      <form onSubmit={save} className="space-y-4">
        <Input
          label="Organisation name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
        {error   && <p className="text-xs text-error">{error}</p>}
        {success && <p className="text-xs text-success">Saved!</p>}
        <Button type="submit" loading={saving}>Save changes</Button>
      </form>
    </div>
  );
}
