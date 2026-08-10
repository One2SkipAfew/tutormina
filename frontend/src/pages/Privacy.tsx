export default function Privacy() {
  return (
    <div className="animate-fade-in" style={{ padding: '4rem 1rem', minHeight: 'calc(100vh - 200px)', display: 'flex', justifyContent: 'center' }}>
      <div className="glass-card" style={{ maxWidth: '800px', width: '100%', background: 'var(--color-background)', padding: '3rem' }}>
        <h1 style={{ color: 'var(--color-olive-dark)', fontSize: '2.5rem', marginBottom: '2rem', borderBottom: '2px solid var(--color-spring-light)', paddingBottom: '1rem' }}>
          Privacy Policy
        </h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--color-text-main)', lineHeight: '1.6' }}>
          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>1. Introduction</h2>
            <p>
              From B 2 C (operating as TutorMina) respects your privacy and is committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you, in compliance with the Protection of Personal Information Act 4 of 2013 (POPIA).
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>2. Data We Collect</h2>
            <p>
              We may collect, use, store and transfer different kinds of personal data about you, including but not limited to:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li><strong>Identity Data:</strong> First name, last name, username or similar identifier.</li>
              <li><strong>Contact Data:</strong> Email address and telephone numbers.</li>
              <li><strong>Profile Data:</strong> Your interests, preferences, feedback, qualifications (for professionals), and session recordings (subject to your consent).</li>
              <li><strong>Technical Data:</strong> IP address, browser type and version, time zone setting, and operating system.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>3. How We Use Your Data</h2>
            <p>
              We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
              <li>To register you as a new user or professional on our platform.</li>
              <li>To manage your bookings, sessions, and payments.</li>
              <li>To provide AI-generated session summaries and insights (only processed within secure environments).</li>
              <li>To comply with a legal or regulatory obligation.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>4. Data Security & Liability</h2>
            <p>
              We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorised way, altered, or disclosed. However, transmission of information via the internet is not completely secure. 
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Disclaimer:</strong> While we take all reasonable steps to protect your personal information in accordance with POPIA, From B 2 C holds no responsibility for any damages, losses, or data breaches resulting from unauthorised access beyond our reasonable control, or arising from your direct interactions with independent professionals on our platform.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>5. Your Legal Rights (POPIA)</h2>
            <p>
              Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, or to object to processing. To exercise any of these rights, please contact us at admin@fromb2c.africa.
            </p>
          </section>

          <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            Last Updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
