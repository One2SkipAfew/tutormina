export default function Terms() {
  return (
    <div className="animate-fade-in" style={{ padding: '4rem 1rem', minHeight: 'calc(100vh - 200px)', display: 'flex', justifyContent: 'center' }}>
      <div className="glass-card" style={{ maxWidth: '800px', width: '100%', background: 'var(--color-background)', padding: '3rem' }}>
        <h1 style={{ color: 'var(--color-olive-dark)', fontSize: '2.5rem', marginBottom: '2rem', borderBottom: '2px solid var(--color-spring-light)', paddingBottom: '1rem' }}>
          Terms and Conditions
        </h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--color-text-main)', lineHeight: '1.6' }}>
          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>1. Introduction</h2>
            <p>
              Welcome to TutorMina (operated by From B 2 C). These Terms and Conditions govern your access to and use of our platform. By registering an account, booking a session, or using our services, you agree to be bound by these terms. These terms are governed by the laws of the Republic of South Africa, including but not limited to the Companies Act 71 of 2008.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>2. Independent Contractors</h2>
            <p>
              TutorMina acts solely as a platform to connect students and clients with independent professionals (tutors and coaches). While we conduct a vetting process to verify the qualifications of our professionals, they are strictly <strong>independent contractors</strong> and are not employees, agents, or representatives of From B 2 C.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>3. Limitation of Liability and Disclaimer</h2>
            <p>
              To the maximum extent permitted by applicable South African law, From B 2 C and TutorMina expressly disclaim all liability for any direct, indirect, incidental, consequential, or special damages arising out of your use of the platform or your interactions with any professional. 
            </p>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>We hold no responsibility for any fraud, misrepresentation, financial loss, personal injury, or any other damages incurred as a result of dealing with the professionals on our platform.</strong> Users engage with professionals entirely at their own risk.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>4. User Responsibilities</h2>
            <p>
              Users are expected to conduct themselves professionally and respectfully during all sessions. Any abuse, harassment, or violation of our community guidelines may result in immediate suspension or termination of your account without a refund.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>5. Payments and Refunds</h2>
            <p>
              All payments for sessions are facilitated through our platform. Refund policies for cancellations are handled in accordance with the specific terms outlined during the booking process. Disputes regarding the quality of a session must be raised within 48 hours of the session's conclusion.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--color-olive-dark)', marginBottom: '0.75rem' }}>6. Amendments</h2>
            <p>
              We reserve the right to amend these Terms and Conditions at any time. Continued use of the platform following any modifications constitutes your acceptance of the revised terms.
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
