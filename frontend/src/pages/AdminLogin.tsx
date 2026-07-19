import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut();
      setError('This account does not have admin access.');
      setLoading(false);
      return;
    }

    // Full reload so AuthContext fetches the profile fresh rather than racing its own
    // async post-sign-in state.
    window.location.href = '/dashboard/admin/applications';
    setLoading(false);
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '4rem', maxWidth: '440px' }}>
      <div className="glass-card">
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--color-olive-dark)' }}>
          Admin Access
        </h2>

        {error && (
          <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="admin-email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email Address</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label htmlFor="admin-password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
