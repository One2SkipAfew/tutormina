import type { ProviderDetails } from '../types/lms';

// ============ SOCIAL LINKS ============
// Professionals may enter either a bare handle ("@jane.doe", "jane.doe") or a full profile URL.
// We store what they typed (trimmed) and normalise it to a safe https:// link at render time.
// Only URLs on each platform's own domain(s) are ever emitted, so no arbitrary / javascript: links.

export type SocialKey =
  | 'social_instagram'
  | 'social_linkedin'
  | 'social_twitter'
  | 'social_facebook'
  | 'social_tiktok';

export type SocialPlatformId = 'instagram' | 'linkedin' | 'twitter' | 'facebook' | 'tiktok';

export type SocialValues = Record<SocialKey, string>;

export interface SocialPlatform {
  id: SocialPlatformId;
  key: SocialKey;
  label: string;
  placeholder: string;
  /** Hostnames (without www./m.) accepted when a full URL is pasted. */
  domains: string[];
  /** Builds a canonical profile URL from a bare handle. */
  buildUrl: (handle: string) => string;
  /** Brand colour used for icon hover states. */
  color: string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: 'linkedin',
    key: 'social_linkedin',
    label: 'LinkedIn',
    placeholder: 'linkedin.com/in/your-name',
    domains: ['linkedin.com'],
    buildUrl: (h) => `https://www.linkedin.com/in/${h}`,
    color: '#0A66C2',
  },
  {
    id: 'instagram',
    key: 'social_instagram',
    label: 'Instagram',
    placeholder: '@yourhandle',
    domains: ['instagram.com', 'instagr.am'],
    buildUrl: (h) => `https://www.instagram.com/${h}`,
    color: '#E4405F',
  },
  {
    id: 'twitter',
    key: 'social_twitter',
    label: 'X / Twitter',
    placeholder: '@yourhandle',
    domains: ['x.com', 'twitter.com'],
    buildUrl: (h) => `https://x.com/${h}`,
    color: '#000000',
  },
  {
    id: 'facebook',
    key: 'social_facebook',
    label: 'Facebook',
    placeholder: 'facebook.com/yourpage',
    domains: ['facebook.com', 'fb.com'],
    buildUrl: (h) => `https://www.facebook.com/${h}`,
    color: '#1877F2',
  },
  {
    id: 'tiktok',
    key: 'social_tiktok',
    label: 'TikTok',
    placeholder: '@yourhandle',
    domains: ['tiktok.com'],
    buildUrl: (h) => `https://www.tiktok.com/@${h}`,
    color: '#000000',
  },
];

export const SOCIAL_KEYS = SOCIAL_PLATFORMS.map((p) => p.key);

const MAX_LENGTH = 200;
const HANDLE_RE = /^[A-Za-z0-9._-]{1,100}$/;

export const EMPTY_SOCIAL_VALUES: SocialValues = {
  social_instagram: '',
  social_linkedin: '',
  social_twitter: '',
  social_facebook: '',
  social_tiktok: '',
};

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || /^(www\.|m\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(value);
}

function parseSocial(platform: SocialPlatform, raw: string | null | undefined): { url: string | null; error: string | null } {
  const value = (raw ?? '').trim();
  if (!value) return { url: null, error: null };
  if (value.length > MAX_LENGTH) return { url: null, error: `Must be under ${MAX_LENGTH} characters.` };

  if (looksLikeUrl(value)) {
    let parsed: URL;
    try {
      parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      return { url: null, error: 'That doesn’t look like a valid link.' };
    }
    const host = parsed.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '');
    if (!platform.domains.includes(host)) {
      return { url: null, error: `Please use a ${platform.label} link (${platform.domains[0]}).` };
    }
    const path = parsed.pathname.replace(/\/+$/, '');
    if (!path) return { url: null, error: `Please include your ${platform.label} profile path.` };
    return { url: `https://${parsed.hostname.toLowerCase()}${path}${parsed.search}`, error: null };
  }

  const handle = value.replace(/^@+/, '');
  if (!HANDLE_RE.test(handle)) {
    return { url: null, error: 'Use your handle (letters, numbers, . _ -) or paste your profile link.' };
  }
  return { url: platform.buildUrl(handle), error: null };
}

/** Returns a user-facing error for an invalid entry, or null if empty / valid. */
export function validateSocial(platform: SocialPlatform, raw: string | null | undefined): string | null {
  return parseSocial(platform, raw).error;
}

/** Returns a safe, canonical https URL for the entry, or null if empty / invalid. */
export function getSocialUrl(platform: SocialPlatform, raw: string | null | undefined): string | null {
  return parseSocial(platform, raw).url;
}

/** Reads the social fields off a provider_details row into editable form state. */
export function socialValuesFromDetails(details: Partial<ProviderDetails> | null | undefined): SocialValues {
  const values = { ...EMPTY_SOCIAL_VALUES };
  if (!details) return values;
  for (const key of SOCIAL_KEYS) values[key] = details[key] ?? '';
  return values;
}

/** Converts form state into a payload for saveProviderDetails (empty strings become null). */
export function socialValuesToPayload(values: SocialValues): Record<SocialKey, string | null> {
  const payload = {} as Record<SocialKey, string | null>;
  for (const key of SOCIAL_KEYS) {
    const trimmed = values[key].trim();
    payload[key] = trimmed ? trimmed : null;
  }
  return payload;
}

/** Returns the first validation error across all fields (prefixed with the platform), or null. */
export function firstSocialError(values: SocialValues): string | null {
  for (const platform of SOCIAL_PLATFORMS) {
    const err = validateSocial(platform, values[platform.key]);
    if (err) return `${platform.label}: ${err}`;
  }
  return null;
}

/** Resolves the valid social links on a provider for display. */
export function getProviderSocialLinks(details: Partial<ProviderDetails> | null | undefined): { platform: SocialPlatform; url: string }[] {
  if (!details) return [];
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    const url = getSocialUrl(platform, details[platform.key]);
    return url ? [{ platform, url }] : [];
  });
}
