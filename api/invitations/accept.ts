/**
 * POST /api/invitations/accept
 *
 * Accept an invitation by token. Creates the org_members row and marks the
 * invitation as accepted. Returns the org slug so the client can redirect.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { adminSupabase } from '../_lib/supabase';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const AcceptSchema = z.object({
  token: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Validate input --------------------------------------------------------
  let body: z.infer<typeof AcceptSchema>;
  try {
    body = AcceptSchema.parse(req.body);
  } catch (err) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Identify the accepting user from JWT ----------------------------------
  const authHeader = req.headers.authorization ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const userClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // 3. Look up invitation ----------------------------------------------------
  const { data: invitation, error: fetchErr } = await adminSupabase
    .from('invitations')
    .select('id, org_id, email, role, accepted_at, expires_at')
    .eq('token', body.token)
    .single() as {
      data: {
        id: string;
        org_id: string;
        email: string;
        role: string;
        accepted_at: string | null;
        expires_at: string;
      } | null;
      error: unknown;
    };

  if (fetchErr || !invitation) {
    return res.status(404).json({ error: 'Invitation not found' });
  }

  if (invitation.accepted_at) {
    return res.status(409).json({ error: 'Invitation has already been accepted' });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Invitation has expired' });
  }

  // Optionally validate email matches (soft check — user may have signed up
  // with the same email they were invited on)
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return res.status(403).json({
      error: `This invitation was sent to ${invitation.email}. Please sign in with that email address.`,
    });
  }

  // 4. Add to org_members ----------------------------------------------------
  const { error: memberErr } = await adminSupabase
    .from('org_members')
    .insert({
      org_id:  invitation.org_id,
      user_id: user.id,
      role:    invitation.role,
    });

  // Ignore conflict — user may already be a member
  if (memberErr && !memberErr.message.includes('duplicate key')) {
    console.error('org_members insert error', memberErr);
    return res.status(500).json({ error: 'Failed to add you to the organisation' });
  }

  // 5. Mark invitation as accepted -------------------------------------------
  const { error: updateErr } = await adminSupabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  if (updateErr) {
    console.error('invitation update error', updateErr);
    // Non-fatal — user is already added to org
  }

  // 6. Audit log -------------------------------------------------------------
  await adminSupabase.from('audit_log').insert({
    org_id:   invitation.org_id,
    user_id:  user.id,
    action:   'accept_invitation',
    metadata: { invitation_id: invitation.id, role: invitation.role },
  });

  return res.status(200).json({ org_id: invitation.org_id });
}
