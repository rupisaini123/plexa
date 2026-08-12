import { describe, it, expect } from 'vitest';
import { metadataPath } from '../src/plex/adapter.js';

describe('metadataPath', () => {
  it('prefixes string rating keys with /library/metadata/', () => {
    expect(metadataPath('2396')).toBe('/library/metadata/2396');
  });

  it('leaves absolute library paths unchanged', () => {
    expect(metadataPath('/library/metadata/2396')).toBe('/library/metadata/2396');
  });
});
