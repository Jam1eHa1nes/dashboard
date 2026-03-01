import { Navigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrg }  from '../../contexts/OrgContext';
import { PageSpinner } from '../ui/Spinner';

interface ProtectedRouteProps {
  children:  ReactNode;
  adminOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { orgs, loading: orgLoading }  = useOrg();
  const { orgId }                       = useParams<{ orgId?: string }>();

  if (authLoading || orgLoading) return <PageSpinner />;

  // Not logged in
  if (!user) return <Navigate to="/login" replace />;

  // If an orgId is present in the URL, verify membership
  if (orgId) {
    const org = orgs.find(o => o.id === orgId);

    // Not a member of this org
    if (!org) return <Navigate to="/" replace />;

    // Admin-only route (settings, audit log)
    if (adminOnly && !['owner', 'admin'].includes(org.role)) {
      return <Navigate to={`/org/${orgId}`} replace />;
    }
  }

  return <>{children}</>;
}
