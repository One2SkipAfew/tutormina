import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

type Role = 'customer' | 'tutor' | 'coach';

export default function Register() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Register with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          role: role,
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // 2. The profile is normally created by a trigger, but if not, we create it here.
      // Since we defined the schema, let's insert into profiles manually if needed, 
      // or assume a database trigger exists. Let's do a direct insert for now.
      const status = role === 'customer' ? 'approved' : 'pending';
      
      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: authData.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
          role: role,
          status: status
        }
      ]);

      if (profileError) {
        // If profile already exists due to a trigger, it's fine.
        console.warn('Profile creation warning:', profileError);
      }

      // If tutor or coach, we need to insert a provider_details row to start the vetting application
      if (role === 'tutor' || role === 'coach') {
        const { error: providerError } = await supabase.from('provider_details').insert([
          {
            profile_id: authData.user.id,
            is_tutor: role === 'tutor',
            is_coach: role === 'coach'
          }
        ]);
        if (providerError) console.warn('Provider creation warning:', providerError);
        
        // Navigate to the application/vetting form
        navigate('/vetting-application');
      } else {
        // Customers go to dashboard
        navigate('/dashboard');
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '4rem', maxWidth: '600px' }}>
      <div className="glass-card">
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--color-olive-dark)' }}>
          Join TutorMina
        </h2>
        
        {error && (
          <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="firstName" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>First Name</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="lastName" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Last Name</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>I want to join as a:</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="role" value="customer" checked={role === 'customer'} onChange={() => setRole('customer')} />
                Customer (Student / Parent)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="role" value="tutor" checked={role === 'tutor'} onChange={() => setRole('tutor')} />
                Tutor
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="role" value="coach" checked={role === 'coach'} onChange={() => setRole('coach')} />
                Coach
              </label>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--color-text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-spring-dark)', fontWeight: 600 }}>Log in here</Link>
        </p>
      </div>
    </div>
  );
}
