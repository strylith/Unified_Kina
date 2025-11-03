// Runtime configuration helpers
// Determines run mode and API base URLs; feature flags for placeholders

export function getRunMode() {
  // Always use real API now that backend uses real Supabase
  return 'api';
}

export function isProduction() {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return !isLocalhost;
}

// Get Guest backend port (defaults to 3001 for development)
function getGuestPort() {
  // In browser, we can't access process.env directly
  // Check if we're on localhost and use default port 3001
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return '3001'; // Guest system port
  }
  // For production or other hosts, derive from current location or use configured URL
  return window.location.port || '3001';
}

export function getApiBase() {
  if (isProduction()) {
    return 'https://kina-resort-main-production.up.railway.app/api';
  }
  // Development: use Guest system port (3001)
  const port = getGuestPort();
  return `http://localhost:${port}/api`;
}

export function getMockBase() {
  const port = getGuestPort();
  return `http://localhost:${port}/mock`;
}

export const FEATURE_FLAGS = {
  ai: false,
  weather: false
};



