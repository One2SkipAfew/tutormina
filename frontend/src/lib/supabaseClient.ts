import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.');
}

// Dev only: gives each browser tab a fully independent auth session, so you can log into
// a different role (student/tutor/coach/admin) in each tab simultaneously for local testing.
// Two things are needed, not just sessionStorage:
//  1. sessionStorage instead of localStorage - localStorage is shared across every tab of
//     the same origin, so one login would overwrite every other tab's session.
//  2. A unique storageKey per tab - supabase-js also opens a BroadcastChannel named after
//     the storageKey to sync auth events across tabs. If every tab uses the same default
//     key, they'd all still receive each other's sign-in/out events over that channel and
//     get their in-memory session confused, even with sessionStorage. A per-tab storageKey
//     gives each tab its own channel too, so there's no cross-tab bleed at all.
// Production keeps the default (shared key + localStorage) so real users stay logged in
// consistently across tabs/restarts, and tabs correctly sync sign-out, as expected.
function getDevTabStorageKey(): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  const bootstrapKey = 'tutormina-dev-tab-id';
  let tabId = window.sessionStorage.getItem(bootstrapKey);
  if (!tabId) {
    tabId = crypto.randomUUID();
    window.sessionStorage.setItem(bootstrapKey, tabId);
  }
  return `sb-dev-tab-${tabId}-auth-token`;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: import.meta.env.DEV ? window.sessionStorage : window.localStorage,
    storageKey: getDevTabStorageKey(),
  },
});
