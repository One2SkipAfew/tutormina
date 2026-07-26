
import { useLocation, useNavigate } from 'react-router-dom';
import { useAILivestream } from '../contexts/AILivestreamContext';
import { Radio, Mic, Pause, Square } from 'lucide-react';

export default function ActiveRecordingWidget() {
  const { transcript } = useAILivestream();
  const location = useLocation();
  const navigate = useNavigate();

  // Only show if we are recording (or paused) AND not on the live session page
  const isActive = transcript.isListening || transcript.isPaused;
  const isLiveSessionPage = location.pathname === '/dashboard/live-session';

  if (!isActive || isLiveSessionPage) {
    return null;
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 9999,
      border: '1px solid #eee'
    }}>
      <div 
        onClick={() => navigate('/dashboard/live-session')}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          cursor: 'pointer' 
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: transcript.isPaused ? '#f3f4f6' : '#fee2e2',
          color: transcript.isPaused ? '#6b7280' : '#ef4444',
          animation: transcript.isListening ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
        }}>
          <Radio size={20} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
            {transcript.isPaused ? 'Recording Paused' : 'Live Recording'}
          </span>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', fontFamily: 'monospace' }}>
            {formatTime(transcript.duration)}
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '8px', borderLeft: '1px solid #e5e7eb', paddingLeft: '16px' }}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            transcript.togglePause();
          }}
          title={transcript.isPaused ? 'Resume' : 'Pause'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: '#4b5563',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {transcript.isPaused ? <Mic size={18} /> : <Pause size={18} />}
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            transcript.stop();
          }}
          title="Stop"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Square size={18} />
        </button>
      </div>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
          }
        `}
      </style>
    </div>
  );
}
