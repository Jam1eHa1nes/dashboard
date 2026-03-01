import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Run } from '../types/supabase';

export function useRuns(projectId: string | undefined, limit = 30) {
  const [runs,    setRuns]    = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('runs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      setRuns(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  // Append a new run from realtime subscription without re-fetching
  function prependRun(run: Run) {
    setRuns(prev => [run, ...prev].slice(0, limit));
  }

  return { runs, loading, error, refresh: fetch, prependRun };
}
