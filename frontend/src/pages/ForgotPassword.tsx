import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useModal } from '../contexts/NotificationContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { showModal } = useModal();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      showModal({ type: 'error', title: 'Reset Failed', message: error.message, buttons: [{ label: 'Try Again', variant: 'primary', onClick: 'dismiss' }] });
    } else {
      showModal({
        type: 'info',
        title: 'Check Your Email',
        message: `We've sent password reset instructions to ${email}. Please check your inbox and spam folder.`,
        buttons: [{ label: 'Back to Login', variant: 'primary', onClick: () => navigate('/login') }],
      });
    }
    setLoading(false);
  };

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '4rem', maxWidth: '500px' }}>
      <div className="glass-card">
        <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--color-olive-dark)' }}>
          Reset Password
        </h2>

        <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', textAlign: 'center' }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-gray-warm)',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--color-text-muted)' }}>
          Remember your password? <Link to="/login" style={{ color: 'var(--color-spring-dark)', fontWeight: 600 }}>Log In</Link>
        </p>
      </div>
    </div>
  );
}
