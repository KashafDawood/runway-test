/**
 * Split a display name into first/last for Player roster records.
 * lastName is always non-empty (schema-required); single-token names use "-" for last name.
 */
export function splitDisplayNameForPlayer(
  displayName: string | undefined,
  emailLocalFallback?: string
): { firstName: string; lastName: string } {
  const raw = (displayName || emailLocalFallback || 'Player').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || 'Player';
  const lastName =
    parts.length > 1 ? parts.slice(1).join(' ').trim() : '-';
  return { firstName, lastName };
}
