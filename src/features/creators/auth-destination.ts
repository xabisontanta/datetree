/** Destinations are paths, never origins. URL parsing catches encoded separators. */
export function safeAuthDestination(value: unknown, fallback = '/dashboard') {
  if (typeof value !== 'string' || value.length > 2048) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (!value.startsWith('/') || decoded.startsWith('//') || /[\\\r\n]/.test(decoded))
      return fallback;
    const url = new URL(value, 'https://date-tree.invalid');
    return url.origin === 'https://date-tree.invalid'
      ? url.pathname + url.search
      : fallback;
  } catch {
    return fallback;
  }
}
