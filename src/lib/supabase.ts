import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe environment variable resolution with fallback to Vercel integration variables
const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

const supabaseUrl =
  metaEnv.NEXT_PUBLIC_VRCL_SUPA_SUPABASE_URL ||
  metaEnv.VITE_SUPABASE_URL ||
  'https://orphcusijzkxpxkzapjp.supabase.co';

const supabaseAnonKey =
  metaEnv.VRCL_SUPA_SUPABASE_ANON_KEY ||
  metaEnv.NEXT_PUBLIC_VRCL_SUPA_SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycGhjdXNpanpreHB4a3phcGpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NTU4NzEsImV4cCI6MjEwNDUzMTg3MX0.h86erOJ8UkJTyTUeASdBKPggdWxS07jBjHIldeTao3Y';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
