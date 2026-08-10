import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

// ============================================
// Types
// ============================================

type ModalType = 'success' | 'error' | 'info' | 'warning';
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ModalButton {
  label: string;
  variant?: 'primary' | 'outline';
  onClick: 'dismiss' | (() => void);
}

interface ModalConfig {
  type: ModalType;
  title: string;
  message?: string;
  buttons?: ModalButton[];
}

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  createdAt: number;
}

interface ModalContextValue {
  showModal: (config: ModalConfig) => void;
  dismissModal: () => void;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => void;
}

// ============================================
// Contexts
// ============================================

const ModalContext = createContext<ModalContextValue | null>(null);
const ToastContext = createContext<ToastContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within NotificationProvider');
  return ctx;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within NotificationProvider');
  return ctx;
}

// ============================================
// Icons
// ============================================

const MODAL_ICONS: Record<ModalType, { emoji: string; bg: string; border: string }> = {
  success: { emoji: '✅', bg: '#f0fdf4', border: '#86efac' },
  error:   { emoji: '❌', bg: '#fef2f2', border: '#fca5a5' },
  info:    { emoji: 'ℹ️', bg: '#eff6ff', border: '#93c5fd' },
  warning: { emoji: '⚠️', bg: '#fffbeb', border: '#fcd34d' },
};

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string; bar: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', text: '#166534', bar: '#22c55e' },
  error:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', bar: '#ef4444' },
  info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', bar: '#3b82f6' },
  warning: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', bar: '#f59e0b' },
};

// ============================================
// Modal Component
// ============================================

function ModalOverlay({ config, onDismiss }: { config: ModalConfig; onDismiss: () => void }) {
  const { type, title, message, buttons } = config;
  const icon = MODAL_ICONS[type];

  const defaultButtons: ModalButton[] = buttons && buttons.length > 0
    ? buttons
    : [{ label: 'OK', variant: 'primary', onClick: 'dismiss' }];

  const handleClick = (btn: ModalButton) => {
    if (btn.onClick === 'dismiss') {
      onDismiss();
    } else {
      btn.onClick();
      onDismiss();
    }
  };

  return (
    <div className="tm-modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="tm-modal-card">
        {/* Icon */}
        <div className="tm-modal-icon" style={{ backgroundColor: icon.bg, borderColor: icon.border }}>
          <span style={{ fontSize: '2rem' }}>{icon.emoji}</span>
        </div>

        {/* Title */}
        <h2 className="tm-modal-title">{title}</h2>

        {/* Message */}
        {message && <p className="tm-modal-message">{message}</p>}

        {/* Buttons */}
        <div className="tm-modal-buttons">
          {defaultButtons.map((btn, i) => (
            <button
              key={i}
              className={`btn ${btn.variant === 'outline' ? 'btn-outline' : 'btn-primary'}`}
              onClick={() => handleClick(btn)}
              style={{ flex: defaultButtons.length > 1 ? 1 : undefined, minWidth: defaultButtons.length === 1 ? '160px' : undefined }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Toast Component
// ============================================

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const colors = TOAST_COLORS[toast.type];
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const remaining = toast.duration - (Date.now() - toast.createdAt);
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, Math.max(remaining, 0));
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={`tm-toast-card ${exiting ? 'tm-toast-exit' : 'tm-toast-enter'}`}
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>
          {toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : toast.type === 'warning' ? '⚡' : 'ℹ️'}
        </span>
        <p style={{ color: colors.text, fontSize: '0.875rem', fontWeight: 500, margin: 0, flex: 1, lineHeight: 1.4 }}>
          {toast.message}
        </p>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: colors.text,
            fontSize: '1.1rem', padding: '0 0.2rem', opacity: 0.6, flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
      <div className="tm-toast-progress">
        <div
          className="tm-toast-progress-bar"
          style={{
            backgroundColor: colors.bar,
            animationDuration: `${toast.duration}ms`,
          }}
        />
      </div>
    </div>
  );
}

// ============================================
// Provider
// ============================================

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const showModal = useCallback((config: ModalConfig) => {
    setModalConfig(config);
  }, []);

  const dismissModal = useCallback(() => {
    setModalConfig(null);
  }, []);

  const showToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = `toast-${++toastIdRef.current}`;
    setToasts(prev => [...prev, { id, type, message, duration, createdAt: Date.now() }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ModalContext.Provider value={{ showModal, dismissModal }}>
      <ToastContext.Provider value={{ showToast }}>
        {children}

        {/* Modal Layer */}
        {modalConfig && (
          <ModalOverlay config={modalConfig} onDismiss={dismissModal} />
        )}

        {/* Toast Layer */}
        {toasts.length > 0 && (
          <div className="tm-toast-container">
            {toasts.map(t => (
              <ToastCard key={t.id} toast={t} onDismiss={dismissToast} />
            ))}
          </div>
        )}
      </ToastContext.Provider>
    </ModalContext.Provider>
  );
}
