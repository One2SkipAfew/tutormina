import { createClient } from '@supabase/supabase-js';

// Use local Supabase URL and Service Role Key (from frontend/.env.local or standard local values)
// Service role key is required to bypass RLS and create users with a specific role directly.
const SUPABASE_URL = process.argv[2] || 'http://127.0.0.1:55321';
const SUPABASE_SERVICE_KEY = process.argv[3] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ADMINS = [
  { email: 'admin@fromb2c.africa', firstName: 'Admin', lastName: 'One' },
  { email: 'kthubisi@fromb2c.africa', firstName: 'Kthubisi', lastName: 'FromB2C' },
  { email: 'kmthubisi@gmail.com', firstName: 'Kmthubisi', lastName: 'Gmail' },
];

async function createAdmins() {
  console.log('Creating admin accounts...');
  for (const admin of ADMINS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: admin.email,
      password: 'TestAdmin1234!',
      email_confirm: true,
      user_metadata: {
        first_name: admin.firstName,
        last_name: admin.lastName,
        role: 'admin'
      }
    });

    if (error) {
      console.error(`Failed to create ${admin.email}:`, error.message);
    } else {
      console.log(`Created ${admin.email} (ID: ${data.user.id})`);
    }
  }
  console.log('Done!');
}

createAdmins();
