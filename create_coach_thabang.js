import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'http://127.0.0.1:55321';
const envFile = fs.readFileSync('./.env.local', 'utf-8');
const anonKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(supabaseUrl, anonKey);

async function createCoach() {
  const email = `thabang@tutormina.example.com`;
  
  // 1. Register
  console.log('Registering user...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: 'password123',
    options: { data: { first_name: 'Thabang', last_name: 'Oliphant', role: 'coach' } }
  });

  if (authError) return console.error('Signup error', authError);

  const userId = authData.user.id;
  console.log('User created:', userId);

  // 2. Insert Profile
  console.log('Inserting profile...');
  const { error: profileError } = await supabase.from('profiles').insert([
    { id: userId, email, first_name: 'Thabang', last_name: 'Oliphant', role: 'coach', status: 'approved' }
  ]);
  
  if (profileError) {
      console.warn('Profile Insert Error (might be handled by trigger):', profileError.message);
      // Wait, let's update it to 'approved' just in case the trigger made it 'pending'
      await supabase.from('profiles').update({ status: 'approved' }).eq('id', userId);
  }

  // 3. Insert Provider Details
  console.log('Inserting provider details...');
  const bio = `Welcome to my profile! I'm an ex-McKinsey Consultant with a deep passion and interest in contributing to guiding people to success! I've been engaged in 100+ interviews and 700+ coaching sessions and gained tremendous success in helping candidates land their dream consulting offers! Whilst at McKinsey, I was awarded as Top Coach across Europe, Middle East & Africa in 2023. So putting that all together, I know exactly what it takes to be successful in MBB interviews, and I know how to get YOU there! If you're interested in landing a consulting role at an MBB Firm or any other Top Consulting Firm, I'd be happy to partner with you on that journey and guide you to success!`;
  
  const { error: providerError } = await supabase.from('provider_details').insert([
    { 
        profile_id: userId, 
        is_coach: true, 
        coach_type: 'executive',
        avatar_url: 'https://user-assets.joinleland.com/profile-photos/69d9e6dff9230816f5499e6b.jpg',
        bio: bio,
        rating: 5.0,
        review_count: 66,
        completed_sessions: 1050,
        years_of_experience: 5,
        specialties: ['Behavioral Interview Prep', 'Case Interview Prep', 'Case Math', 'Cover Letters', 'Frameworks', 'Networking Strategy', 'Resume Review', 'Salary Negotiation', 'Skill Building'],
        offers_virtual: true
    }
  ]);
  
  if (providerError) {
      console.warn('Provider Insert Error (might be handled by trigger):', providerError.message);
      await supabase.from('provider_details').update({ 
        is_coach: true, 
        coach_type: 'executive',
        avatar_url: 'https://user-assets.joinleland.com/profile-photos/69d9e6dff9230816f5499e6b.jpg',
        bio: bio,
        rating: 5.0,
        review_count: 66,
        completed_sessions: 1050,
        years_of_experience: 5,
        specialties: ['Behavioral Interview Prep', 'Case Interview Prep', 'Case Math', 'Cover Letters', 'Frameworks', 'Networking Strategy', 'Resume Review', 'Salary Negotiation', 'Skill Building'],
        offers_virtual: true
      }).eq('profile_id', userId);
  }

  // 4. Insert Schedules (Monday to Friday, 09:00 to 17:00)
  console.log('Inserting schedules...');
  const schedules = [1, 2, 3, 4, 5].map(day => ({
    provider_id: userId,
    day_of_week: day,
    start_time: '09:00:00',
    end_time: '17:00:00'
  }));

  const { error: scheduleError } = await supabase.from('provider_schedules').insert(schedules);
  if (scheduleError) {
    console.warn('Schedule Insert Error:', scheduleError.message);
  }

  console.log('Successfully created Thabang coach account!');
  console.log('Email:', email);
  console.log('Password: password123');
}

createCoach();
