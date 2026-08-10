// Minimal fetch-based Supabase client for the extension. Not using @supabase/supabase-js
// here since a raw MV3 extension has no bundler in this project - REST calls against
// PostgREST/GoTrue/Storage cover everything this extension needs.

const SESSION_KEY = 'tutormina_session';

async function getSession() {
  const { [SESSION_KEY]: session } = await chrome.storage.local.get(SESSION_KEY);
  return session || null;
}

async function setSession(session) {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

async function clearSession() {
  await chrome.storage.local.remove(SESSION_KEY);
}

async function signInWithPassword(email, password) {
  const res = await fetch(`${TUTORMINA_CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: TUTORMINA_CONFIG.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Sign-in failed');

  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user.id,
    email: data.user.email,
  };
  await setSession(session);
  return session;
}

async function signOut() {
  await clearSession();
}

// Supabase access tokens are short-lived (1h by default). Decode the JWT payload client-side
// (no signature check needed - we're just reading our own token's expiry) to know when to
// refresh, instead of waiting for a request to fail with "exp claim timestamp check failed".
function decodeJwtExp(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp; // seconds since epoch
  } catch {
    return null;
  }
}

function isExpiringSoon(token, bufferSeconds = 60) {
  const exp = decodeJwtExp(token);
  if (!exp) return true;
  return Date.now() / 1000 > exp - bufferSeconds;
}

async function refreshSession(refreshToken) {
  const res = await fetch(`${TUTORMINA_CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: TUTORMINA_CONFIG.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Session refresh failed');

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user.id,
    email: data.user.email,
  };
}

// Returns a session guaranteed not to be near expiry, refreshing (and persisting the refresh)
// first if needed. Only usable from contexts with chrome.storage access (not offscreen.js).
async function getValidSession() {
  const session = await getSession();
  if (!session) return null;
  if (!isExpiringSoon(session.access_token)) return session;

  const refreshed = await refreshSession(session.refresh_token);
  await setSession(refreshed);
  return refreshed;
}

// tokenOverride lets callers that already have the access token in hand (e.g. the offscreen
// document, which has NO chrome.storage access at all - Chrome only exposes chrome.runtime
// there - and gets its session via a message from the service worker instead) skip the
// chrome.storage.local read that getSession() would otherwise do.
async function authedFetch(path, options = {}, tokenOverride) {
  const accessToken = tokenOverride ?? (await getSession())?.access_token;
  if (!accessToken) throw new Error('Not signed in');

  const res = await fetch(`${TUTORMINA_CONFIG.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: TUTORMINA_CONFIG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  return res;
}

async function insertRow(table, row, tokenOverride) {
  const res = await authedFetch(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row),
  }, tokenOverride);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Insert into ${table} failed`);
  return Array.isArray(data) ? data[0] : data;
}

async function updateRow(table, id, updates, tokenOverride) {
  const res = await authedFetch(`/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(updates),
  }, tokenOverride);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Update ${table} failed`);
  return Array.isArray(data) ? data[0] : data;
}

async function uploadObject(bucket, path, blob, tokenOverride) {
  const res = await authedFetch(`/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  }, tokenOverride);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Upload failed');
  }
}
