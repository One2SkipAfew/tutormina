import { getProviderSocialLinks } from '../../lib/socialLinks';
import type { ProviderDetails } from '../../types/lms';
import SocialIcon from './SocialIcon';
import '../../styles/social-links.css';

interface SocialLinksProps {
  details: Partial<ProviderDetails> | null | undefined;
  /** Name used in accessible labels, e.g. "Jane Doe on LinkedIn". */
  ownerName?: string;
  size?: 'sm' | 'md';
  align?: 'center' | 'start';
  style?: React.CSSProperties;
}

/** Row of brand icon links for a professional's social profiles. Renders nothing if none are set. */
export default function SocialLinks({ details, ownerName, size = 'sm', align = 'center', style }: SocialLinksProps) {
  const links = getProviderSocialLinks(details);
  if (links.length === 0) return null;

  return (
    <ul className={`social-links social-links--${size} social-links--${align}`} style={style} aria-label="Social media profiles">
      {links.map(({ platform, url }) => {
        const label = ownerName ? `${ownerName} on ${platform.label}` : platform.label;
        return (
          <li key={platform.id}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="social-link"
              style={{ '--social-brand': platform.color } as React.CSSProperties}
              aria-label={label}
              title={label}
            >
              <SocialIcon platform={platform.id} size={size === 'md' ? 18 : 15} />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
