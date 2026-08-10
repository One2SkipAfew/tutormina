import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:55321';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUsers() {
  const { data: users, error: err1 } = await supabase.auth.admin.listUsers();
  if (err1) {
    console.error('Error fetching auth users:', err1);
    return;
  }
  console.log('AUTH USERS:', JSON.stringify(users.users.map(u => ({ email: u.email, confirmed_at: u.confirmed_at, last_sign_in_at: u.last_sign_in_at })), null, 2));

  const { data: profiles, error: err2 } = await supabase.from('profiles').select('email, role, status');
  if (err2) {
    console.error('Error fetching profiles:', err2);
    return;
  }
  console.log('PROFILES:', JSON.stringify(profiles, null, 2));
}

checkUsers();
