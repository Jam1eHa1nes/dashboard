import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase }  from '../../lib/supabase';
import { useAuth }   from '../../contexts/AuthContext';
import { useOrg }    from '../../contexts/OrgContext';
import { Button }    from '../../components/ui/Button';
import { Input }     from '../../components/ui/Input';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function CreateOrg() {
  const { user }    = useAuth();
  const { refresh } = useOrg();
  const navigate    = useNavigate();
  const [name,    setName]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');

    const slug = slugify(name.trim());
    const { data: orgId, error } = await supabase.rpc('create_org', {
      p_name: name.trim(),
      p_slug: slug,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await refresh();
    navigate(`/org/${orgId}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold text-accent mb-1">QACore</h1>
          <p className="text-sm text-muted">Create your organisation to get started</p>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-8 space-y-6">
          <h2 className="font-heading text-lg font-semibold text-text">New Organisation</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Organisation name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Acme Corp"
              required
            />
            {error && <p className="text-xs text-error">{error}</p>}
            <Button type="submit" className="w-full" loading={loading} disabled={!name.trim()}>
              Create organisation
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
