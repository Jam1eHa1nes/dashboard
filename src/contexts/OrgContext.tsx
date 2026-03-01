import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { OrgWithRole } from '../types/supabase';
import { useAuth } from './AuthContext';

interface OrgContextValue {
  orgs:       OrgWithRole[];
  currentOrg: OrgWithRole | null;
  loading:    boolean;
  setCurrentOrgById: (orgId: string) => void;
  refresh:    () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgs,    setOrgs]    = useState<OrgWithRole[]>([]);
  const [currentOrg, setCurrentOrg] = useState<OrgWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrgs = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setCurrentOrg(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_orgs', { p_user_id: user.id });
      if (error) throw error;
      setOrgs(data ?? []);
    } catch (err) {
      console.error('Failed to fetch orgs', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  function setCurrentOrgById(orgId: string) {
    const org = orgs.find(o => o.id === orgId) ?? null;
    setCurrentOrg(org);
  }

  return (
    <OrgContext.Provider value={{
      orgs,
      currentOrg,
      loading,
      setCurrentOrgById,
      refresh: fetchOrgs,
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used inside OrgProvider');
  return ctx;
}
