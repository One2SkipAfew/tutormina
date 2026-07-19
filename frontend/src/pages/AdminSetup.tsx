import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AdminSetup() {
  const [checking, setChecking] = useState(true);
  const [alreadySetUp, setAlreadySetUp] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('admin_exists').then(({ data, error }) => {
      if (!error) setAlreadySetUp(!!data);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, role: 'admin' } },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        status: 'approved',
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      // Full reload (not React Router navigate) so AuthContext fetches the fresh admin
      // profile from scratch, rather than racing its own async signup/session state.
      window.location.href = '/dashboard/admin/applications';
    }

    setLoading(false);
  };

  if (checking) {
    return <div className="container" style={{ paddingTop: '4rem', textAlign: 'center' }}>Checking...</div>;
  }

  if (alreadySetUp) {
    return (
      <div className="container animate-fade-in" style={{ paddingTop: '4rem', maxWidth: '500px' }}>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-olive-dark)' }}>Setup already complete</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '1rem 0 1.5rem' }}>
            An admin account already exists for TutorMina.
          </p>
          <Link to="/admin-login" className="btn btn-primary" style={{ textDecoration: 'none' }}>Go to Admin Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '4rem', maxWidth: '500px' }}>
      <div className="glass-card">
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--color-olive-dark)' }}>
          Create Super Admin
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          One-time setup. This form disables itself once an admin account exists.
        </p>

        {error && (
          <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>First Name</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Last Name</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
            {loading ? 'Creating...' : 'Create Super Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
