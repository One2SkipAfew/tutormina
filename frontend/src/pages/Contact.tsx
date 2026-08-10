import { useState } from 'react';
import { useModal, useToast } from '../contexts/NotificationContext';
import { AI_API_BASE } from '../lib/aiApi';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showModal } = useModal();
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !subject || !message) {
      showToast('error', 'Please fill in all fields before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${AI_API_BASE}/contact-us`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message.');
      }

      showModal({
        type: 'success',
        title: 'Message Sent',
        message: 'Thank you for reaching out! We have received your message and will get back to you shortly.',
        buttons: [{ label: 'Return Home', variant: 'primary', onClick: () => { window.location.href = '/'; } }],
      });

      // Clear the form
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      showModal({
        type: 'error',
        title: 'Send Failed',
        message: 'There was an issue sending your message. Please try again later.',
        buttons: [{ label: 'Dismiss', variant: 'outline', onClick: 'dismiss' }],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '4rem 1rem', minHeight: 'calc(100vh - 200px)', display: 'flex', justifyContent: 'center' }}>
      <div className="glass-card" style={{ maxWidth: '600px', width: '100%', background: 'var(--color-background)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: 'var(--color-olive-dark)', fontSize: '2.5rem', marginBottom: '0.5rem' }}>Contact Us</h1>
          <p style={{ color: 'var(--color-text-muted)' }}>We'd love to hear from you. Fill out the form below and our team will get back to you.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-main)' }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem',
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-main)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem',
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-main)' }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What is this regarding?"
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem',
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text-main)' }}>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here..."
              rows={5}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', resize: 'vertical'
              }}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '1rem', fontSize: '1.1rem', marginTop: '0.5rem', background: 'var(--color-olive-dark)' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
}
