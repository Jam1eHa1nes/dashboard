import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Run } from '../types/supabase';

/**
 * Subscribe to new runs for a project via Supabase Realtime.
 * Calls onNewRun whenever a new run is inserted.
 */
export function useRealtimeRuns(
  projectId: string | undefined,
  onNewRun: (run: Run) => void
) {
  const callbackRef = useRef(onNewRun);
  callbackRef.current = onNewRun;

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`runs:project:${projectId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'runs',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          callbackRef.current(payload.new as Run);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
