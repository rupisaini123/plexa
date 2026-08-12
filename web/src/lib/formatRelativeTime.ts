function parseTimestamp(timestamp: string): Date {
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    return new Date(`${normalized}Z`);
  }
  return new Date(normalized);
}

export function formatRelativeTime(timestamp: string): string {
  const date = parseTimestamp(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const absSec = Math.abs(diffSec);

  if (absSec < 60) return rtf.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  const diffDay = Math.round(diffHour / 24);
  return rtf.format(diffDay, 'day');
}
