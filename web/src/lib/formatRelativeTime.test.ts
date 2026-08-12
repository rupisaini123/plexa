import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './formatRelativeTime';

describe('formatRelativeTime', () => {
  it('formats recent timestamps as relative time', () => {
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const iso = twoMinutesAgo.toISOString().slice(0, 19);
    expect(formatRelativeTime(iso)).toMatch(/2 minutes ago/);
  });

  it('parses sqlite-style timestamps', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sqlite = oneHourAgo.toISOString().slice(0, 19).replace('T', ' ');
    expect(formatRelativeTime(sqlite)).toMatch(/hour/);
  });
});
