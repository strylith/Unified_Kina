// Public environment configuration for the guest site.
// Fill these values with your Supabase project details.
// Note: Using the ANON key on the client is expected and safe for public usage.

export const SUPABASE_URL = 'https://gjaskifzrqjcesdnnqpa.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqYXNraWZ6cnFqY2VzZG5ucXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Nzc1OTgsImV4cCI6MjA3NjQ1MzU5OH0.Yo8yHJ8KifrTsQDziVIsfC49LTYGlDQiujTsWAsOMXw';

// This must exactly match an allowed redirect URL in Supabase Auth settings
// and the page we create at /auth/callback.html
export const REDIRECT_URL = 'http://localhost:3001/auth/callback.html';

// Enable extra console logging for Google OAuth troubleshooting
export const DEBUG_AUTH = true;



