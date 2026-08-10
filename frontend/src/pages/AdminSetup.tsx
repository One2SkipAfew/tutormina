import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';
import { useModal } from '../contexts/NotificationContext';

export default function AdminSetup() {
  const [showPassword, setShowPassword] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showModal } = useModal();



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, role: 'admin' } },
    });

    if (authError) {
      showModal({ type: 'error', title: 'Setup Failed', message: authError.message, buttons: [{ label: 'Try Again', variant: 'primary', onClick: 'dismiss' }] });
      setLoading(false);
      return;
    }

    if (authData.user) {
      // The database trigger on_auth_user_created automatically inserts the profile
      // with the role='admin' from the metadata we passed above. 
      // We don't need to manually insert it here (doing so causes a 400 error 
      // because the bootstrap trigger blocks duplicate admins).

      // Full reload (not React Router navigate) so AuthContext fetches the fresh admin
      // profile from scratch, rather than racing its own async signup/session state.
      window.location.href = '/dashboard/admin/applications';
    }

    setLoading(false);
  };



  return (
    <div className="container animate-fade-in" style={{ paddingTop: '4rem', maxWidth: '500px' }}>
      <div className="glass-card">
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--color-olive-dark)' }}>
          Create Super Admin
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          One-time setup. This form disables itself once an admin account exists.
        </p>



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
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: '1rem' }}>
            {loading ? 'Creating...' : 'Create Super Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}
