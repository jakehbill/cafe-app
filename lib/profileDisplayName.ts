import type { UserProfile } from '@/lib/profile';

function trimText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function lastInitial(lastName: string): string {
  const t = trimText(lastName);
  if (!t) return '';
  return t.charAt(0).toUpperCase();
}

/** Public headline: first name + last initial (e.g. "Jake B"). Never shows full last name. */
export function formatNameWithLastInitial(
  firstName: string,
  lastName?: string | null
): string {
  const first = trimText(firstName);
  const last = trimText(lastName ?? '');
  if (!first) return '';
  const initial = lastInitial(last);
  return initial ? `${first} ${initial}` : first;
}

function formatDisplayNameAsFirstLastInitial(displayName: string): string | null {
  const parts = trimText(displayName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return formatNameWithLastInitial(parts[0], parts.slice(1).join(' '));
}

function emailLocalPart(email: string): string {
  const i = email.indexOf('@');
  return i > 0 ? email.slice(0, i) : email;
}

/**
 * Profile headline priority:
 * 1. profiles.first_name (+ last initial)
 * 2. Auth metadata first_name
 * 3. profiles.display_name or Auth display_name → first + last initial
 * 4. username
 * 5. email local part
 */
export function resolveProfileHeadline(
  profile: UserProfile | null,
  authMetadata: Record<string, unknown> | undefined,
  email: string
): string {
  const profileFirst = trimText(profile?.first_name);
  if (profileFirst) {
    return formatNameWithLastInitial(profileFirst, profile?.last_name) || profileFirst;
  }

  const metaFirst = trimText(String(authMetadata?.first_name ?? ''));
  const metaLast = trimText(String(authMetadata?.last_name ?? ''));
  if (metaFirst) {
    return formatNameWithLastInitial(metaFirst, metaLast) || metaFirst;
  }

  const display =
    trimText(profile?.display_name) || trimText(String(authMetadata?.display_name ?? ''));
  if (display) {
    const formatted = formatDisplayNameAsFirstLastInitial(display);
    if (formatted) return formatted;
  }

  const username = trimText(profile?.username);
  if (username) {
    const handle = username.startsWith('@') ? username.slice(1) : username;
    return `@${handle}`;
  }

  if (email) return emailLocalPart(email);
  return 'Your account';
}

export function resolveProfileUsernameLabel(profile: UserProfile | null): string | null {
  const username = trimText(profile?.username);
  if (!username) return null;
  return username.startsWith('@') ? username : `@${username}`;
}

/** Show email under headline only when it adds context (headline is not the email prefix). */
export function shouldShowProfileEmail(headline: string, email: string): boolean {
  const trimmedEmail = trimText(email);
  if (!trimmedEmail) return false;
  const prefix = emailLocalPart(trimmedEmail);
  return headline.trim().toLowerCase() !== prefix.toLowerCase();
}
