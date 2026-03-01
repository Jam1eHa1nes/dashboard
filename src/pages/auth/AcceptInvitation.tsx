import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { acceptInvitation } from '../../lib/api';
import { useAuth }           from '../../contexts/AuthContext';
import { useOrg }            from '../../contexts/OrgContext';
import { PageSpinner }       from '../../components/ui/Spinner';
import { Button }            from '../../components/ui/Button';

export default function AcceptInvitation() {
  const { token }   = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const { refresh } = useOrg();
  const navigate    = useNavigate();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!token || authLoading) return;
    if (!user) return; // wait for login

    async function accept() {
      setStatus('loading');
      try {
        const { org_id } = await acceptInvitation(token!);
        await refresh();
        setStatus('success');
        setTimeout(() => navigate(`/org/${org_id}`), 1500);
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : 'Failed to accept invitation');
        setStatus('error');
      }
    }

    accept();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, authLoading]);

  if (authLoading || status === 'loading') return <PageSpinner />;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h2 className="font-heading text-xl font-semibold text-text">Sign in to accept</h2>
          <p className="text-sm text-muted">You need to sign in before accepting this invitation.</p>
          <Link to={`/login?next=/accept-invitation/${token}`}>
            <Button className="w-full">Sign in</Button>
          </Link>
          <Link to={`/signup?next=/accept-invitation/${token}`}>
            <Button variant="secondary" className="w-full">Create account</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">🎉</div>
          <h2 className="font-heading text-xl font-semibold text-text">You're in!</h2>
          <p className="text-sm text-muted">Redirecting to your organisation…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h2 className="font-heading text-xl font-semibold text-error">Invitation error</h2>
          <p className="text-sm text-muted">{errMsg}</p>
          <Link to="/"><Button variant="secondary">Go home</Button></Link>
        </div>
      </div>
    );
  }

  return <PageSpinner />;
}
