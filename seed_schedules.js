import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'http://127.0.0.1:55321';
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(supabaseUrl, serviceKey);

async function seedSchedules() {
  const { data: profiles } = await supabase.from('profiles').select('id').in('role', ['coach', 'tutor']);
  
  if (!profiles) return console.log('No coaches found');

  for (const profile of profiles) {
    const schedules = [1, 2, 3, 4, 5].map(day => ({
      provider_id: profile.id,
      day_of_week: day,
      start_time: '09:00:00',
      end_time: '17:00:00'
    }));

    const { error } = await supabase.from('provider_schedules').insert(schedules);
    if (error) {
      console.warn('Error inserting for', profile.id, error.message);
    } else {
      console.log('Inserted schedules for', profile.id);
    }
  }
}

seedSchedules();
