import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth }  from '../../contexts/AuthContext';
import { Button }   from '../../components/ui/Button';
import { Input }    from '../../components/ui/Input';
import { Github }   from 'lucide-react';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  }

  async function handleGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options:  { redirectTo: `${window.location.origin}/` },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold text-accent mb-1">QACore</h1>
          <p className="text-sm text-muted">Test intelligence for engineering teams</p>
        </div>

        <div className="rounded-2xl border border-border bg-panel p-8 space-y-6">
          <h2 className="font-heading text-lg font-semibold text-text">Sign in</h2>

          <button
            onClick={handleGitHub}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-panel-alt py-2.5 text-sm text-text hover:bg-border transition-colors"
          >
            <Github size={16} />
            Continue with GitHub
          </button>

          <div className="flex items-center gap-3 text-xs text-muted">
            <div className="flex-1 h-px bg-border" />or<div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            {error && <p className="text-xs text-error">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>

          <p className="text-center text-xs text-muted">
            No account?{' '}
            <Link to="/signup" className="text-accent hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
