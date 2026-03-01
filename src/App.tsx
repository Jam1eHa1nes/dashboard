import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }            from './contexts/AuthContext';
import { OrgProvider, useOrg as useOrgContext } from './contexts/OrgContext';
import { ProtectedRoute }          from './components/layout/ProtectedRoute';
import { PageSpinner }             from './components/ui/Spinner';

// Auth
const Login            = lazy(() => import('./pages/auth/Login'));
const Signup           = lazy(() => import('./pages/auth/Signup'));
const AcceptInvitation = lazy(() => import('./pages/auth/AcceptInvitation'));

// Onboarding
const CreateOrg = lazy(() => import('./pages/onboarding/CreateOrg'));

// Org
const OrgOverview      = lazy(() => import('./pages/org/OrgOverview'));
const OrgSettings      = lazy(() => import('./pages/org/OrgSettings'));
const GeneralSettings  = lazy(() => import('./pages/org/GeneralSettings'));
const Members          = lazy(() => import('./pages/org/Members'));
const AuditLog         = lazy(() => import('./pages/org/AuditLog'));

// Projects
const ProjectList   = lazy(() => import('./pages/projects/ProjectList'));
const ProjectDetail = lazy(() => import('./pages/projects/ProjectDetail'));
const ApiKeys       = lazy(() => import('./pages/projects/ApiKeys'));

// Runs
const RunDetail = lazy(() => import('./pages/runs/RunDetail'));

// Generator
const RepoGenerator = lazy(() => import('./pages/generator/RepoGenerator'));


export default function App() {
  return (
    <AuthProvider>
      <OrgProvider>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* Public */}
            <Route path="/login"                       element={<Login />} />
            <Route path="/signup"                      element={<Signup />} />
            <Route path="/accept-invitation/:token"    element={<AcceptInvitation />} />

            {/* Onboarding */}
            <Route path="/onboarding" element={
              <ProtectedRoute><CreateOrg /></ProtectedRoute>
            } />

            {/* Org routes — keyed by org UUID, not slug */}
            <Route path="/org/:orgId" element={
              <ProtectedRoute><OrgOverview /></ProtectedRoute>
            } />
            <Route path="/org/:orgId/projects" element={
              <ProtectedRoute><ProjectList /></ProtectedRoute>
            } />
            <Route path="/org/:orgId/projects/:projectId" element={
              <ProtectedRoute><ProjectDetail /></ProtectedRoute>
            } />
            <Route path="/org/:orgId/projects/:projectId/runs/:runId" element={
              <ProtectedRoute><RunDetail /></ProtectedRoute>
            } />
            <Route path="/org/:orgId/projects/:projectId/api-keys" element={
              <ProtectedRoute adminOnly><ApiKeys /></ProtectedRoute>
            } />
            <Route path="/org/:orgId/generate" element={
              <ProtectedRoute><RepoGenerator /></ProtectedRoute>
            } />

            {/* Settings */}
            <Route path="/org/:orgId/settings" element={
              <ProtectedRoute adminOnly><OrgSettings /></ProtectedRoute>
            }>
              <Route index          element={<GeneralSettings />} />
              <Route path="members" element={<Members />} />
            </Route>

            {/* Audit log */}
            <Route path="/org/:orgId/audit-log" element={
              <ProtectedRoute adminOnly><AuditLog /></ProtectedRoute>
            } />

            {/* Root */}
            <Route path="/" element={
              <ProtectedRoute><SmartRedirect /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </OrgProvider>
    </AuthProvider>
  );
}

// Redirect to first org or onboarding
function SmartRedirect() {
  const { orgs, loading } = useOrgContext();
  if (loading) return <PageSpinner />;
  if (orgs.length > 0) return <Navigate to={`/org/${orgs[0].id}`} replace />;
  return <Navigate to="/onboarding" replace />;
}
