export function normalizePublicHttpsUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

export function validatePublicHttpsUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Enter a valid HTTPS URL (e.g. https://your-domain.example.com)';
  }

  if (parsed.protocol !== 'https:') {
    return 'URL must use HTTPS';
  }

  if (!parsed.hostname) {
    return 'Enter a valid HTTPS URL (e.g. https://your-domain.example.com)';
  }

  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    if (parsed.pathname === '/alexa' || parsed.pathname.startsWith('/alexa/')) {
      return 'Use the base URL only — do not include /alexa';
    }
    return 'Use the origin only — no path after the domain';
  }

  if (parsed.search || parsed.hash) {
    return 'Use the origin only — no query or hash';
  }

  return null;
}
