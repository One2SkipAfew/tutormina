import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="animate-fade-in">
      {/* Section 1: Welcome / Hero */}
      <section className="section" style={{ paddingTop: '8rem', paddingBottom: '8rem' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <img src="/logo.png" alt="TutorMina Logo" style={{ width: '200px', height: 'auto', marginBottom: '2rem' }} />
          <h1 style={{ color: 'var(--color-olive-dark)', fontSize: '3.5rem', marginBottom: '1rem' }}>
            Grow with TutorMina
          </h1>
          <p style={{ fontSize: '1.25rem', color: 'var(--color-text-muted)', maxWidth: '600px', marginBottom: '2.5rem' }}>
            Empowering students and professionals to smash their goals. Connect with expert tutors and experienced executive coaches for virtual, holistic support.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/directory" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>Find a Tutor or Coach</Link>
          </div>
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
              <h3 style={{ color: 'var(--color-olive-dark)', fontSize: '1.5rem', borderBottom: '2px solid var(--color-spring-light)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                🎒 Expert Tutoring
              </h3>
              <p style={{ marginBottom: '1rem' }}><strong>Super Revision:</strong> High-impact summaries & past paper walk-throughs!</p>
              <p style={{ marginBottom: '1rem' }}><strong>All Graders:</strong> Tailored assistance spanning Grades 0 to 12 & Varsity level!</p>
              <p style={{ marginBottom: '1rem' }}><strong>Diverse Needs:</strong> Loving & fully specialized support for ADHD/learning styles!</p>
              <p><strong>Total Confidence:</strong> Equipping students with key skills to smash their goals!</p>
            </div>

            <div className="glass-card" style={{ background: 'var(--color-background)' }}>
              <h3 style={{ color: 'var(--color-beige-dark)', fontSize: '1.5rem', borderBottom: '2px solid var(--color-tan-light)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                🤝 Professional Coaching
              </h3>
              <p style={{ marginBottom: '1rem' }}><strong>Behavioural Coaches:</strong> Holistic, experienced life coaches dedicated to personal growth and overcoming challenges.</p>
              <p><strong>Executive Coaches:</strong> Previous executives coaching prospective employees on the best techniques and methods to land executive positions, including careers in MBB management consulting companies.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Features & Call to Action */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', color: 'var(--color-olive-dark)', marginBottom: '1.5rem' }}>
            Why Join TutorMina?
          </h2>
          <p style={{ fontSize: '1.2rem', color: 'var(--color-text-muted)', maxWidth: '800px', margin: '0 auto 3rem auto' }}>
            Our platform goes beyond just connecting you. We offer built-in virtual meeting rooms, seamless calendar bookings, secure in-platform chat, and cutting-edge AI features to summarize and pull insights directly from your recorded sessions.
          </p>
          
          <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', background: 'rgba(255, 255, 255, 0.9)' }}>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--color-text-main)' }}>Ready to unlock your potential?</h3>
            <Link to="/register" className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.2rem' }}>
              Create an Account Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
