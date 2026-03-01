/**
 * POST /api/invitations
 *
 * Send an invitation email to a new org member.
 * Caller must be owner or admin of the org.
 *
 * Email is sent via Supabase Auth admin.inviteUserByEmail(), which uses
 * the SMTP settings configured in your Supabase project (Auth → SMTP Settings).
 * No third-party email service required.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { adminSupabase } from './_lib/supabase';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const InviteSchema = z.object({
  org_id: z.string().uuid(),
  email:  z.string().email(),
  role:   z.enum(['admin', 'member', 'viewer']),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Parse JWT from Authorization header -----------------------------------
  const authHeader = req.headers.authorization ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  // 2. Validate input --------------------------------------------------------
  let body: z.infer<typeof InviteSchema>;
  try {
    body = InviteSchema.parse(req.body);
  } catch (err) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Verify caller identity via Supabase JWT --------------------------------
  const userClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // 4. Check caller is owner/admin of the org --------------------------------
  const { data: member, error: memberErr } = await adminSupabase
    .from('org_members')
    .select('role')
    .eq('org_id',  body.org_id)
    .eq('user_id', user.id)
    .single();

  if (memberErr || !member) {
    return res.status(403).json({ error: 'You are not a member of this organisation' });
  }
  if (!['owner', 'admin'].includes(member.role)) {
    return res.status(403).json({ error: 'Only owners and admins can invite members' });
  }

  // 5. Create invitation record ----------------------------------------------
  const token = randomBytes(32).toString('hex');
  const dashboardUrl = process.env.VITE_APP_URL ?? 'https://your-app.vercel.app';
  const acceptUrl    = `${dashboardUrl}/accept-invitation/${token}`;

  const { data: invitation, error: inviteErr } = await adminSupabase
    .from('invitations')
    .insert({
      org_id:     body.org_id,
      email:      body.email,
      role:       body.role,
      token,
      invited_by: user.id,
    })
    .select()
    .single();

  if (inviteErr || !invitation) {
    console.error('invitation insert error', inviteErr);
    return res.status(500).json({ error: 'Failed to create invitation' });
  }

  // 6. Send email via Supabase Auth ------------------------------------------
  // inviteUserByEmail() creates the user (if they don't exist) and sends a
  // magic-link style invitation email using your Supabase SMTP configuration.
  // The redirectTo URL is where they land after clicking — our accept page
  // reads the token from our invitations table via the URL param.
  const { error: emailErr } = await adminSupabase.auth.admin.inviteUserByEmail(
    body.email,
    {
      redirectTo: acceptUrl,
      data: {
        // These values are available in the Supabase email template as
        // {{ .Data.org_name }} etc. if you customise the template.
        invited_by: user.email ?? user.id,
        org_id:     body.org_id,
        role:       body.role,
      },
    }
  );

  if (emailErr) {
    // Non-fatal: invitation row is created. Log the error and still return
    // the accept_url so the admin can share it manually if needed.
    console.error('Supabase invite email error:', emailErr.message);
  }

  // 7. Audit log -------------------------------------------------------------
  await adminSupabase.from('audit_log').insert({
    org_id:   body.org_id,
    user_id:  user.id,
    action:   'invite_member',
    metadata: {
      email:         body.email,
      role:          body.role,
      invitation_id: invitation.id,
      email_sent:    !emailErr,
    },
  });

  return res.status(201).json({
    invitation_id: invitation.id,
    accept_url:    acceptUrl,
    expires_at:    invitation.expires_at,
    email_sent:    !emailErr,
  });
}
