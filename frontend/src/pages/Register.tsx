import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';

type Role = 'customer' | 'tutor' | 'coach';
type UserType = 'student' | 'professional' | null;

export default function Register() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('customer');
  const [userType, setUserType] = useState<UserType>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUserTypeSelect = (type: UserType) => {
    setUserType(type);
    if (type === 'student') {
      setRole('customer');
    } else {
      setRole('tutor');
    }
  };

  const handleProfessionalSubType = (r: 'tutor' | 'coach') => {
    setRole(r);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
      setSuccess(true);
    }
    
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        // Note: Google signups will default to 'customer' role
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const cardBase: React.CSSProperties = {
    flex: 1,
    padding: '1.5rem',
    borderRadius: '12px',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    textAlign: 'center',
    background: '#fafafa',
    position: 'relative',
    overflow: 'hidden',
  };

  const cardSelected: React.CSSProperties = {
    borderColor: 'var(--color-spring-dark)',
    background: 'linear-gradient(135deg, rgba(139,183,63,0.06) 0%, rgba(139,183,63,0.12) 100%)',
    boxShadow: '0 4px 16px rgba(139,183,63,0.15)',
  };

  const cardHover = (e: React.MouseEvent, selected: boolean) => {
    if (!selected) {
      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(139,183,63,0.4)';
      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
    }
  };

  const cardLeave = (e: React.MouseEvent, selected: boolean) => {
    if (!selected) {
      (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
    }
  };

  const checkMark: React.CSSProperties = {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'var(--color-spring-dark)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
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

        {success ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
            <h3 style={{ color: 'var(--color-olive-dark)', marginBottom: '1rem' }}>Check your email</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
              We've sent a confirmation link to <strong>{email}</strong>. Please click the link to activate your account.
            </p>
            <Link to="/login" className="btn btn-outline">Return to Login</Link>
          </div>
        ) : (
          <>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#ffffff',
                color: '#757575',
                border: '1px solid #ddd',
                borderRadius: 'var(--radius-md)',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {loading ? 'Connecting...' : 'Sign up with Google'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', color: '#aaa' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }} />
              <span style={{ padding: '0 0.5rem', fontSize: '0.875rem' }}>OR REGISTER WITH EMAIL</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#ddd' }} />
            </div>

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="firstName" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>First Name</label>
              <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="lastName" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Last Name</label>
              <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email Address</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-warm)', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-gray-warm)',
                  fontFamily: 'inherit'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* User Type Selector — Step 1 */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.95rem' }}>I want to join as a:</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div role="button" tabIndex={0} onClick={() => handleUserTypeSelect('student')} onKeyDown={(e) => e.key === 'Enter' && handleUserTypeSelect('student')}
                onMouseOver={(e) => cardHover(e, userType === 'student')} onMouseOut={(e) => cardLeave(e, userType === 'student')}
                style={{ ...cardBase, ...(userType === 'student' ? cardSelected : {}) }}>
                {userType === 'student' && <span style={checkMark}>✓</span>}
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎓</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-main)', marginBottom: '0.25rem' }}>Student</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  Find tutors &amp; coaches, book sessions, and access learning resources
                </div>
              </div>

              <div role="button" tabIndex={0} onClick={() => handleUserTypeSelect('professional')} onKeyDown={(e) => e.key === 'Enter' && handleUserTypeSelect('professional')}
                onMouseOver={(e) => cardHover(e, userType === 'professional')} onMouseOut={(e) => cardLeave(e, userType === 'professional')}
                style={{ ...cardBase, ...(userType === 'professional' ? cardSelected : {}) }}>
                {userType === 'professional' && <span style={checkMark}>✓</span>}
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤝</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-text-main)', marginBottom: '0.25rem' }}>Professional</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  Offer your expertise as a tutor or coach and grow your practice
                </div>
              </div>
            </div>
          </div>

          {/* Professional Sub-Type — Step 2 (slide-down) */}
          <div style={{
            maxHeight: userType === 'professional' ? '200px' : '0',
            opacity: userType === 'professional' ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.35s ease, opacity 0.3s ease',
          }}>
            <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-olive-dark)' }}>
              What type of professional are you?
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div role="button" tabIndex={userType === 'professional' ? 0 : -1} onClick={() => handleProfessionalSubType('tutor')}
                onKeyDown={(e) => e.key === 'Enter' && handleProfessionalSubType('tutor')}
                onMouseOver={(e) => cardHover(e, role === 'tutor')} onMouseOut={(e) => cardLeave(e, role === 'tutor')}
                style={{ ...cardBase, padding: '1.25rem 1rem', ...(role === 'tutor' ? cardSelected : {}) }}>
                {role === 'tutor' && <span style={checkMark}>✓</span>}
                <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>📚</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-main)', marginBottom: '0.2rem' }}>Tutor</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>Academic support for students of all levels</div>
              </div>

              <div role="button" tabIndex={userType === 'professional' ? 0 : -1} onClick={() => handleProfessionalSubType('coach')}
                onKeyDown={(e) => e.key === 'Enter' && handleProfessionalSubType('coach')}
                onMouseOver={(e) => cardHover(e, role === 'coach')} onMouseOut={(e) => cardLeave(e, role === 'coach')}
                style={{ ...cardBase, padding: '1.25rem 1rem', ...(role === 'coach' ? cardSelected : {}) }}>
                {role === 'coach' && <span style={checkMark}>✓</span>}
                <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>🎯</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-main)', marginBottom: '0.2rem' }}>Coach</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>Career, executive, or behavioural coaching</div>
              </div>
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={loading || !userType} style={{ width: '100%', marginTop: '1rem' }}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
          </form>
          </>
        )}

        <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--color-text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--color-spring-dark)', fontWeight: 600 }}>Log in here</Link>
        </p>
      </div>
    </div>
  );
}
