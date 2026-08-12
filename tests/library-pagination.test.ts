import { describe, it, expect } from 'vitest';
import { clampPageOptions, mapLibrarySort } from '../src/plex/adapter.js';

describe('library pagination helpers', () => {
  it('clamps invalid page sizes', () => {
    expect(clampPageOptions({ start: -5, size: 999 })).toEqual({ start: 0, size: 100, sort: undefined });
    expect(clampPageOptions({ start: 10, size: 0 })).toEqual({ start: 10, size: 50, sort: undefined });
  });

  it('maps UI sorts to plex expressions', () => {
    expect(mapLibrarySort('title', 'artist')).toBe('titleSort');
    expect(mapLibrarySort('titleDesc', 'track')).toBe('titleSort:desc');
    expect(mapLibrarySort('addedAt', 'album')).toBe('addedAt:desc');
    expect(mapLibrarySort('yearDesc', 'album')).toBe('year:desc');
    expect(mapLibrarySort('year', 'artist')).toBeUndefined();
  });
});
