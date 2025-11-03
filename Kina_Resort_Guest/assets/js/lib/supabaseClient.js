// Supabase client initialization for the guest site
import { SUPABASE_URL, SUPABASE_ANON_KEY, DEBUG_AUTH } from '../config/publicEnv.js';

// Import supabase-js v2 via ESM CDN to avoid bundling requirements
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Expose for debugging from DevTools console on pages that don't import the module directly
try { if (typeof window !== 'undefined') { window.supabase = supabase; } } catch {}

if (DEBUG_AUTH) {
  try {
    console.log('[AuthDBG] Supabase client initialized', {
      url: SUPABASE_URL,
      anonKeyPresent: Boolean(SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.length > 10)
    });
  } catch {}
}


