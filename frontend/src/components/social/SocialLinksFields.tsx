import { useState } from 'react';
import { SOCIAL_PLATFORMS, getSocialUrl, validateSocial } from '../../lib/socialLinks';
import type { SocialKey, SocialValues } from '../../lib/socialLinks';
import SocialIcon from './SocialIcon';
import '../../styles/social-links.css';

interface SocialLinksFieldsProps {
  values: SocialValues;
  onChange: (key: SocialKey, value: string) => void;
}

/** Editable inputs for each supported social platform, with inline validation and a link preview. */
export default function SocialLinksFields({ values, onChange }: SocialLinksFieldsProps) {
  // Only surface errors once a field has been left, so users aren't nagged mid-typing.
  const [touched, setTouched] = useState<Partial<Record<SocialKey, boolean>>>({});

  return (
    <div className="social-fields">
      {SOCIAL_PLATFORMS.map((platform) => {
        const value = values[platform.key];
        const error = touched[platform.key] ? validateSocial(platform, value) : null;
        const url = getSocialUrl(platform, value);
        const inputId = `profile-${platform.key.replace('_', '-')}`;

        return (
          <div key={platform.key} className={`social-field${error ? ' social-field--error' : ''}`}>
            <label htmlFor={inputId} className="social-field-label">{platform.label}</label>
            <div className="social-field-control" style={{ '--social-brand': platform.color } as React.CSSProperties}>
              <span className="social-field-icon" aria-hidden="true">
                <SocialIcon platform={platform.id} size={16} />
              </span>
              <input
                id={inputId}
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
                className="social-field-input"
                value={value}
                placeholder={platform.placeholder}
                onChange={(e) => onChange(platform.key, e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, [platform.key]: true }))}
                aria-invalid={!!error}
                aria-describedby={error ? `${inputId}-error` : undefined}
              />
              {url && !error && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-field-preview"
                  title={`Open ${url}`}
                  aria-label={`Preview ${platform.label} link`}
                >
                  ↗
                </a>
              )}
            </div>
            {error && <p id={`${inputId}-error`} className="social-field-error">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
