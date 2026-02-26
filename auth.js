/**
 * auth.js
 *
 * Supabase Auth integration.
 * Exposes: requireAuth(), showUserInfo(), signOut()
 *
 * SETUP REQUIRED in Supabase dashboard:
 *   Auth → URL Configuration → Redirect URLs → add:
 *     https://dashboard.autonami.co.uk/**
 *
 *   To enable Google SSO:
 *     Auth → Providers → Google → enable, add Client ID + Secret
 *     (from Google Cloud Console → APIs & Services → Credentials)
 *
 *   To enable Microsoft SSO:
 *     Auth → Providers → Azure → enable, add Client ID + Secret
 *     (from Azure Portal → App registrations)
 */

const SUPABASE_URL      = 'https://lyjhjuacikrjftwkvtjl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yFOp8H3Br0iYnXFALmaR5Q_D_naDAGR';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Call on every protected page load.
 * Redirects to login.html if no valid session exists.
 */
async function requireAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    window.location.replace('login.html');
    return null;
  }
  return session;
}

/**
 * Populate the user chip in the header with the signed-in user's name/email.
 */
async function showUserInfo() {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;
  const chip = document.getElementById('user-chip');
  if (chip) {
    chip.textContent =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email;
    chip.title = user.email;
  }
}

/** Sign out the current user and redirect to the login page. */
async function signOut() {
  await _supabase.auth.signOut();
  window.location.replace('login.html');
}
