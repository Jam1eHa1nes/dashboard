import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Service-role client for serverless API functions.
 * Bypasses RLS — use only for trusted server-side operations.
 */
export const adminSupabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
