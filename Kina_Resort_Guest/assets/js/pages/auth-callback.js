import { supabase } from '../lib/supabaseClient.js';
import { DEBUG_AUTH } from '../config/publicEnv.js';

// Persistent debug logger (survives page reloads)
function debugLog(step, data) {
  const ts = new Date().toISOString();
  const logEntry = { step, data, timestamp: ts };
  console.log(`[AuthDBG:${step}]`, data);
  
  // Store in localStorage for persistence
  try {
    const logs = JSON.parse(localStorage.getItem('auth_debug_logs') || '[]');
    logs.push(logEntry);
    if (logs.length > 50) logs.shift(); // Keep last 50 entries
    localStorage.setItem('auth_debug_logs', JSON.stringify(logs));
  } catch {}
  
  // Show on-screen debug panel
  if (DEBUG_AUTH) {
    updateDebugPanel(step, data);
  }
}

function updateDebugPanel(step, data) {
  let panel = document.getElementById('auth-debug-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'auth-debug-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;width:400px;max-height:80vh;background:#000;color:#0f0;padding:12px;font-family:monospace;font-size:11px;z-index:99999;overflow-y:auto;border:2px solid #0f0;border-radius:4px;';
    document.body.appendChild(panel);
  }
  const entry = document.createElement('div');
  entry.style.cssText = 'margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:4px;';
  entry.innerHTML = `<div style="color:#0ff;font-weight:bold;">[${step}]</div><pre style="margin:4px 0;white-space:pre-wrap;word-break:break-all;">${JSON.stringify(data, null, 2)}</pre>`;
  panel.insertBefore(entry, panel.firstChild);
  if (panel.children.length > 20) panel.removeChild(panel.lastChild);
}

// Helper: derive a first name from the full_name
function getFirstName(name) {
  if (!name || typeof name !== 'string') return 'Guest';
  return name.trim().split(/\s+/)[0];
}

(async () => {
  try {
    debugLog('CALLBACK_START', { href: location.href, search: location.search });
    
    // Surface provider error (if any) early
    const params = new URLSearchParams(window.location.search);
    const errorDesc = params.get('error_description') || params.get('error');
    const allParams = Object.fromEntries(params.entries());
    debugLog('PARAMS_EXTRACTED', allParams);
    
    if (errorDesc) {
      debugLog('OAUTH_ERROR', { error: errorDesc, allParams });
      console.error('OAuth error:', errorDesc);
      await new Promise(r => setTimeout(r, 3000)); // Delay redirect for debugging
      location.replace('/');
      return;
    }

    // Check for tokens in hash (implicit flow) vs code in query (PKCE flow)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const code = params.get('code');
    
    debugLog('TOKEN_DETECTION', { 
      hasHashToken: !!accessToken, 
      hasQueryCode: !!code,
      hashKeys: Array.from(hashParams.keys()),
      queryKeys: Array.from(params.keys())
    });

    // If tokens are in hash, Supabase auto-detects them (detectSessionInUrl: true)
    // Just need to wait for session to be available
    if (accessToken && !code) {
      debugLog('IMPLICIT_FLOW_DETECTED', { tokenPreview: accessToken.substring(0, 20) + '...' });
      // Wait for Supabase to process the hash tokens
      await new Promise(r => setTimeout(r, 500));
      // Skip exchange, go straight to session fetch
    } else if (code) {
      // PKCE flow - exchange code for session
      debugLog('PKCE_FLOW_DETECTED', { codeLength: code.length, codePreview: code.substring(0, 20) + '...' });
      
      // Force the authorization code exchange
      try {
        debugLog('EXCHANGE_START', { redirectUrl: window.location.href });
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
        const errorDetails = {
          message: error.message,
          status: error.status,
          error: error.error || error.code,
          hint: error.hint || 'Check Supabase redirect URL matches exactly: ' + window.location.origin + '/auth/callback.html',
          fullError: error
        };
        debugLog('EXCHANGE_ERROR', errorDetails);
        console.error('[OAuth] exchangeCodeForSession failed:', errorDetails);
        
        // If it's a redirect mismatch, show helpful error
        if (error.message?.includes('redirect_uri') || error.hint?.includes('redirect')) {
          alert('Redirect URL mismatch. Ensure Supabase Additional Redirect URLs includes:\n' + window.location.origin + '/auth/callback.html');
        }
        await new Promise(r => setTimeout(r, 3000)); // Delay for debugging
        location.replace('/');
        return;
      }
      debugLog('EXCHANGE_SUCCESS', { hasData: !!data, sessionId: data?.session?.access_token?.substring(0, 20) });
      console.log('[OAuth] Code exchanged successfully');
    } catch (e) {
      // Handle non-Supabase errors (network, etc.)
      const exceptionDetails = {
        message: e?.message || e,
        name: e?.name,
        stack: e?.stack,
        fullError: e
      };
      debugLog('EXCHANGE_EXCEPTION', exceptionDetails);
      console.error('[OAuth] exchangeCodeForSession exception:', exceptionDetails);
      await new Promise(r => setTimeout(r, 3000)); // Delay for debugging
      location.replace('/');
      return;
    }
    } else {
      // No code, no token - invalid callback
      debugLog('NO_TOKEN_OR_CODE', { params: allParams, hash: window.location.hash.substring(0, 100) });
      console.error('[OAuth] No code or access_token in callback URL');
      await new Promise(r => setTimeout(r, 3000)); // Delay for debugging
      location.replace('/');
      return;
    }

    // Fetch the session (retry once if needed)
    debugLog('SESSION_FETCH_ATTEMPT_1', {});
    let { data: { session }, error: sessError } = await supabase.auth.getSession();
    debugLog('SESSION_FETCH_RESULT_1', { hasSession: !!session, error: sessError });
    
    if (!session) {
      await new Promise(r => setTimeout(r, 300));
      debugLog('SESSION_FETCH_ATTEMPT_2', {});
      ({ data: { session }, error: sessError } = await supabase.auth.getSession());
      debugLog('SESSION_FETCH_RESULT_2', { hasSession: !!session, error: sessError });
    }

    if (!session) {
      debugLog('NO_SESSION', { error: sessError });
      console.error('No session after exchanging code.');
      await new Promise(r => setTimeout(r, 3000)); // Delay for debugging
      location.replace('/');
      return;
    }

    const user = session.user;
    debugLog('USER_EXTRACTED', { userId: user.id, email: user.email });
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
    const avatarUrl = user.user_metadata?.avatar_url || '';

    // Exchange Supabase access token for server JWT token
    debugLog('OAUTH_EXCHANGE_START', { hasAccessToken: !!session.access_token });
    
    let serverToken = null;
    let appUser = null;
    
    try {
      // Get API base URL (same logic as api.js uses)
      const getApiBase = () => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalhost) {
          return 'http://localhost:3001/api';
        }
        return 'https://kina-resort-main-production.up.railway.app/api';
      };
      
      const apiBase = getApiBase();
      const exchangeUrl = `${apiBase}/auth/oauth-login`;
      
      debugLog('OAUTH_EXCHANGE_REQUEST', { url: exchangeUrl });
      
      const exchangeResponse = await fetch(exchangeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supabaseToken: session.access_token
        })
      });

      const exchangeData = await exchangeResponse.json();
      
      if (!exchangeResponse.ok || !exchangeData.success) {
        throw new Error(exchangeData.error || 'Token exchange failed');
      }

      debugLog('OAUTH_EXCHANGE_SUCCESS', { 
        hasToken: !!exchangeData.token,
        hasUser: !!exchangeData.user,
        userId: exchangeData.user?.id 
      });
      
      serverToken = exchangeData.token;
      appUser = {
        id: exchangeData.user.id,
        firstName: exchangeData.user.firstName,
        lastName: exchangeData.user.lastName,
        email: exchangeData.user.email,
        role: 'customer',
        memberSince: exchangeData.user.memberSince,
        loyaltyPoints: exchangeData.user.loyaltyPoints,
        totalBookings: exchangeData.user.totalBookings,
        avatar_url: avatarUrl
      };
    } catch (exchangeError) {
      debugLog('OAUTH_EXCHANGE_ERROR', { 
        error: exchangeError?.message || exchangeError,
        stack: exchangeError?.stack 
      });
      console.error('[OAuth] Token exchange failed:', exchangeError);
      
      // Fallback: Use Supabase token (will fail on protected routes, but at least user sees error)
      console.warn('[OAuth] Falling back to Supabase token (may cause 401 errors on API calls)');
      serverToken = session.access_token;
      
      // Create minimal user object
      appUser = {
        id: user.id,
        firstName: getFirstName(fullName) || user.email?.split('@')[0] || 'Guest',
        lastName: '',
        email: user.email,
        role: 'customer',
        avatar_url: avatarUrl
      };
    }

    // Store server JWT token and user data
    localStorage.setItem('auth_user', JSON.stringify(appUser));
    localStorage.setItem('auth_token', serverToken);

    // Sync with global auth state and update UI
    try {
      // Import setAuthState dynamically
      const { setAuthState } = await import('../utils/state.js');
      setAuthState({
        isLoggedIn: true,
        user: appUser,
        role: appUser.role || 'customer'
      });
    } catch (stateError) {
      debugLog('STATE_SYNC_ERROR', { error: stateError?.message || stateError });
      console.warn('[OAuth] Failed to sync auth state:', stateError);
    }

    // If the global auth manager exists, sync and update header
    if (window.kinaAuth) {
      try {
        window.kinaAuth.currentUser = appUser;
        window.kinaAuth.updateHeaderForLoggedInUser();
      } catch (authError) {
        debugLog('AUTH_MANAGER_SYNC_ERROR', { error: authError?.message || authError });
        console.warn('[OAuth] Failed to sync with auth manager:', authError);
      }
    }

    debugLog('SUCCESS', { 
      userId: user.id, 
      email: user.email,
      hasAuthUser: !!localStorage.getItem('auth_user'),
      hasAuthToken: !!localStorage.getItem('auth_token')
    });
    console.log('[AuthDBG] Session established for', user.email);
    
    // Redirect into app (with delay for debugging)
    if (DEBUG_AUTH) {
      await new Promise(r => setTimeout(r, 2000)); // 2 second delay to see logs
    }
    // Navigate back to SPA entry (index.html) so router can pick up the session
    // Using absolute path ensures we leave callback.html entirely
    location.replace('/#/packages');
  } catch (err) {
    debugLog('FATAL_ERROR', { 
      message: err?.message, 
      name: err?.name,
      stack: err?.stack,
      fullError: err
    });
    console.error('Auth callback error:', err);
    await new Promise(r => setTimeout(r, 3000)); // Delay for debugging
    location.replace('/');
  }
})();

// Debug helpers exposed to window
try {
  // View all debug logs from localStorage
  window.kinaViewAuthLogs = function() {
    const logs = JSON.parse(localStorage.getItem('auth_debug_logs') || '[]');
    console.table(logs);
    return logs;
  };
  
  // Clear debug logs
  window.kinaClearAuthLogs = function() {
    localStorage.removeItem('auth_debug_logs');
    const panel = document.getElementById('auth-debug-panel');
    if (panel) panel.remove();
    console.log('Auth debug logs cleared');
  };
  
  // Manual exchange test
  window.kinaDebugExchange = async function(){
    try {
      debugLog('MANUAL_TEST_START', { href: location.href });
      const p = new URLSearchParams(location.search);
      debugLog('MANUAL_TEST_PARAMS', { hasCode: !!p.get('code'), error: p.get('error') });
      const result = await supabase.auth.exchangeCodeForSession(location.href);
      debugLog('MANUAL_TEST_EXCHANGE', result);
      const { data, error } = await supabase.auth.getSession();
      debugLog('MANUAL_TEST_SESSION', { hasSession: !!data?.session, error: error?.message });
      return { exchange: result, session: { data, error } };
    } catch (e) {
      debugLog('MANUAL_TEST_EXCEPTION', { message: e?.message, error: e });
      console.error('[DBG] exchange failure', e);
      throw e;
    }
  };
} catch {}


