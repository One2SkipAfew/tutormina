import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'http://127.0.0.1:55321';
const envFile = fs.readFileSync('./.env.local', 'utf-8');
const anonKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, anonKey);

async function testFetch() {
  const email = `test_${Date.now()}@example.com`;
  
  // 1. Register
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: 'password123',
    options: { data: { first_name: 'Test', last_name: 'User', role: 'tutor' } }
  });

  if (authError) return console.error('Signup error', authError);

  const userId = authData.user.id;

  // 2. Insert
  const { error: profileError } = await supabase.from('profiles').insert([
    { id: userId, email, first_name: 'Test', last_name: 'User', role: 'tutor', status: 'pending' }
  ]);
  
  if (profileError) return console.error('Profile Insert Error:', profileError);

  // 3. Select (like the frontend does)
  const { data: profile, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
    
  if (selectError) {
    console.error('Select Error:', selectError);
  } else {
    console.log('Fetched Profile:', profile);
  }
}

testFetch();
