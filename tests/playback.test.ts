import { describe, it, expect } from 'vitest';
import { normalizeSpokenName, bestMatch } from '../src/services/playback.js';

describe('spoken name matching', () => {
  it('normalizes invocation bleed-through', () => {
    expect(normalizeSpokenName('ask plexa to play road trip')).toBe('road trip');
    expect(normalizeSpokenName('play Fleetwood Mac')).toBe('fleetwood mac');
    expect(normalizeSpokenName('evening paath Playlist')).toBe('evening paath');
    expect(normalizeSpokenName('the evening paath playlist')).toBe('evening paath');
  });

  it('finds best playlist match', () => {
    const playlists = [{ title: 'Road Trip' }, { title: 'Jazz Night' }, { title: 'Evening Paath' }];
    expect(bestMatch('road trip', playlists)?.title).toBe('Road Trip');
    expect(bestMatch('jazz', playlists)?.title).toBe('Jazz Night');
    expect(bestMatch('evening paath Playlist', playlists)?.title).toBe('Evening Paath');
  });
});
