import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Briefcase, Video, FolderOpen, Sparkles, Headphones } from 'lucide-react';

export default function Home() {
  const { session } = useAuth();

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="animate-fade-in">
      {/* Section 1: Welcome / Hero */}
      <section className="section hero-section" style={{ paddingTop: '8rem', paddingBottom: '8rem' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <img src="/logo.png" alt="TutorMina Logo" style={{
            width: '200px',
            height: 'auto',
            marginBottom: '2rem',
            mixBlendMode: 'multiply',
            WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 70%)',
            maskImage: 'radial-gradient(circle, black 40%, transparent 70%)'
          }} />
          <h1 className="hero-title">
            Grow with TutorMina
          </h1>
          <p className="hero-subtitle">
            Empowering students and professionals to smash their goals. Connect with expert tutors and experienced executive coaches for virtual, holistic support.
          </p>
          <div className="hero-cta-row">
            <Link to="/directory" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>Find a Tutor or Coach</Link>
          </div>
          <p style={{ marginTop: '1.25rem', fontSize: '0.95rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          </p>
        </div>
      </section>

      {/* Section 2: Offerings (Tutoring & Coaching) */}
      <section className="section section-alt">
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2.5rem', color: 'var(--color-spring-dark)', marginBottom: '3rem' }}>
            Our Offerings
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="glass-card" style={{ background: 'var(--color-background)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-olive-dark)', fontSize: '1.5rem', borderBottom: '2px solid var(--color-spring-light)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <GraduationCap size={28} /> Expert Tutoring
              </h3>
              <p style={{ marginBottom: '1rem' }}><strong>Super Revision:</strong> High-impact summaries & past paper walk-throughs!</p>
              <p style={{ marginBottom: '1rem' }}><strong>All Graders:</strong> Tailored assistance spanning Grades 0 to 12 & Varsity level!</p>
              <p style={{ marginBottom: '1rem' }}><strong>Diverse Needs:</strong> Loving & fully specialized support for ADHD/learning styles!</p>
              <p><strong>Total Confidence:</strong> Equipping students with key skills to smash their goals!</p>
            </div>

            <div className="glass-card" style={{ background: 'var(--color-background)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-beige-dark)', fontSize: '1.5rem', borderBottom: '2px solid var(--color-tan-light)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <Briefcase size={28} /> Professional Coaching
              </h3>
              <p style={{ marginBottom: '1rem' }}><strong>Behavioural Coaches:</strong> Holistic, experienced life coaches dedicated to personal growth and overcoming career challenges. Career coaching and career guidance. Identifying and highlighting skillsets, bringing them to the fore and advising appropriately.</p>
              <p><strong>Executive Coaches:</strong> Previous executives coaching prospective employees on the best techniques and methods to land executive positions, including careers in MBB management consulting companies.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Platform Features */}
      <section className="section">
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2.5rem', color: 'var(--color-olive-dark)', marginBottom: '1rem' }}>
            More Than a Directory
          </h2>
          <p style={{ fontSize: '1.15rem', color: 'var(--color-text-muted)', maxWidth: '800px', margin: '0 auto 3rem auto', textAlign: 'center' }}>
            TutorMina is a complete learning platform built around every session you have — before, during, and after.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.75rem' }}>

            {/* Tile 1 — Video Sessions: olive-green accent */}
            <div className="glass-card" style={{
              background: 'var(--color-background)',
              borderTop: '4px solid var(--color-olive-dark)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(100,120,40,0.13)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(100,120,40,0.1)', marginBottom: '1rem' }}>
                <Video size={24} style={{ color: 'var(--color-olive-dark)' }} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: 'var(--color-olive-dark)' }}>Private 1-on-1 Sessions</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                Book and host secure, private video sessions with your tutor or coach directly on the platform — no separate app, no manual setup, just show up and start.
              </p>
            </div>

            {/* Tile 2 — Resource Library: gold accent */}
            <div className="glass-card" style={{
              background: 'var(--color-background)',
              borderTop: '4px solid var(--color-tan-dark, #b5914a)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(181,145,74,0.13)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(181,145,74,0.12)', marginBottom: '1rem' }}>
                <FolderOpen size={24} style={{ color: 'var(--color-tan-dark, #b5914a)' }} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: 'var(--color-tan-dark, #b5914a)' }}>Shared Resource Library</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                Your tutor or coach can share notes, past papers, and course material straight to your resource library — everything from your sessions, organized in one place.
              </p>
            </div>

            {/* Tile 3 — AI Summaries: spring-green accent */}
            <div className="glass-card" style={{
              background: 'var(--color-background)',
              borderTop: '4px solid var(--color-spring-dark)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(80,150,60,0.13)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(80,160,60,0.1)', marginBottom: '1rem' }}>
                <Sparkles size={24} style={{ color: 'var(--color-spring-dark)' }} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: 'var(--color-spring-dark)' }}>AI Summaries & Insights</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                Upload a document or record a session and let our AI summarize it, pull out key insights, and highlight what to focus on next — automatically.
              </p>
            </div>

            {/* Tile 4 — Chommie: beige-dark / warm rose accent */}
            <div className="glass-card" style={{
              background: 'var(--color-background)',
              borderTop: '4px solid var(--color-beige-dark, #c4856a)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(196,133,106,0.13)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(196,133,106,0.12)', marginBottom: '1rem' }}>
                <Headphones size={24} style={{ color: 'var(--color-beige-dark, #c4856a)' }} />
              </div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: 'var(--color-beige-dark, #c4856a)' }}>Meet Chommie, Your AI Buddy</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                Chommie travels with you through your learning journey — and can even listen in on sessions you hold outside TutorMina, turning them into the same AI-powered notes and insights.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Section 4: Call to Action */}
      <section className="section section-alt">
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: '2.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>
            Your Journey Starts Here
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 3rem auto' }}>
            Whether you're here to learn or to lead — there's a place for you at TutorMina. And the best part? <strong>It's completely free to join.</strong>
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '900px', margin: '0 auto' }}>

            {/* Card: Students & Professionals */}
            <div className="glass-card" style={{ background: 'var(--color-background)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
              <GraduationCap size={40} style={{ color: 'var(--color-olive-dark)' }} />
              <h3 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', margin: 0 }}>
                Students & Professionals
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', lineHeight: '1.65', margin: 0 }}>
                Ready to grow? Whether you're tackling a tough subject, preparing for exams, or levelling up your career skills — TutorMina connects you with the right people to make it happen. <strong>Register today and unlock your full potential.</strong>
              </p>
              <Link to="/register?role=student" className="btn btn-primary" style={{ marginTop: 'auto', padding: '0.875rem 2rem', fontSize: '1rem', width: '100%' }}>
                Start Learning Today →
              </Link>
            </div>

            {/* Card: Coaches & Tutors */}
            <div className="glass-card" style={{ background: 'var(--color-background)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
              <Briefcase size={40} style={{ color: 'var(--color-spring-dark)' }} />
              <h3 style={{ fontSize: '1.5rem', color: 'var(--color-spring-dark)', margin: 0 }}>
                Coaches & Tutors
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', lineHeight: '1.65', margin: 0 }}>
                Your expertise can change someone's life. Share your knowledge, inspire growth, and build your practice with a platform built around you. <strong>Register today as a Coach or Tutor</strong> and start making an impact.
              </p>
              <Link to="/register?role=professional" className="btn btn-primary" style={{ marginTop: 'auto', padding: '0.875rem 2rem', fontSize: '1rem', width: '100%' }}>
                Join as a Coach or Tutor →
              </Link>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
