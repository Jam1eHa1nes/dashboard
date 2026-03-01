/**
 * Client-side API helpers for calling /api/* routes.
 * All functions attach the current Supabase JWT automatically.
 */

import { supabase } from './supabase';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeader();
  const res = await fetch(path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify(body),
  });

  const data = await res.json() as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------
export async function sendInvitation(params: {
  org_id: string;
  email:  string;
  role:   'admin' | 'member' | 'viewer';
}): Promise<{ invitation_id: string; accept_url: string; expires_at: string }> {
  return post('/api/invitations', params);
}

export async function acceptInvitation(token: string): Promise<{ org_id: string }> {
  return post('/api/invitations/accept', { token });
}

// ---------------------------------------------------------------------------
// Repo Generator
// ---------------------------------------------------------------------------
export async function generateRepo(params: {
  language:     string;
  framework:    string;
  projectName:  string;
  orgSlug:      string;
  projectId:    string;
  apiKey:       string;
  dashboardUrl: string;
}): Promise<Blob> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/generate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json() as { error?: string };
    throw new Error(err.error ?? `Generator failed: ${res.status}`);
  }

  return res.blob();
}
