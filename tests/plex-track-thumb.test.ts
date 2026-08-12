import { describe, it, expect } from 'vitest';
import { resolveTrackThumb } from '../src/plex/adapter.js';

describe('resolveTrackThumb', () => {
  it('prefers track thumb when present', () => {
    expect(
      resolveTrackThumb({
        thumb: '/library/metadata/1/thumb/0',
        parentThumb: '/library/metadata/2/thumb/0',
        grandparentThumb: '/library/metadata/3/thumb/0',
      }),
    ).toBe('/library/metadata/1/thumb/0');
  });

  it('falls back to album parentThumb', () => {
    expect(
      resolveTrackThumb({
        parentThumb: '/library/metadata/2/thumb/0',
        grandparentThumb: '/library/metadata/3/thumb/0',
      }),
    ).toBe('/library/metadata/2/thumb/0');
  });

  it('falls back to artist grandparentThumb', () => {
    expect(
      resolveTrackThumb({
        grandparentThumb: '/library/metadata/3/thumb/0',
      }),
    ).toBe('/library/metadata/3/thumb/0');
  });

  it('returns undefined when no thumbs exist', () => {
    expect(resolveTrackThumb({})).toBeUndefined();
  });
});
