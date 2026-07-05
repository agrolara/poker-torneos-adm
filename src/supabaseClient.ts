import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined');

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

// Force rebuild trigger to update environment variables on Coolify

