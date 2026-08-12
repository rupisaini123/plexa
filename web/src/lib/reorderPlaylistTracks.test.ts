import { describe, it, expect } from 'vitest';
import {
  afterPlaylistItemId,
  findMovedIndices,
  reorderArray,
} from './reorderPlaylistTracks';

const items = [
  { playlistItemId: 'a', title: 'A' },
  { playlistItemId: 'b', title: 'B' },
  { playlistItemId: 'c', title: 'C' },
];

describe('reorderPlaylistTracks', () => {
  it('reorderArray moves an item to a new index', () => {
    expect(reorderArray(items, 0, 2).map((item) => item.playlistItemId)).toEqual(['b', 'c', 'a']);
    expect(reorderArray(items, 2, 0).map((item) => item.playlistItemId)).toEqual(['c', 'a', 'b']);
  });

  it('reorderArray returns the same array when indices match or are out of range', () => {
    expect(reorderArray(items, 1, 1)).toBe(items);
    expect(reorderArray(items, -1, 1)).toBe(items);
    expect(reorderArray(items, 0, 5)).toBe(items);
  });

  it('afterPlaylistItemId maps position to the preceding playlist item', () => {
    expect(afterPlaylistItemId(items, 0)).toBeUndefined();
    expect(afterPlaylistItemId(items, 1)).toBe('a');
    expect(afterPlaylistItemId(items, 2)).toBe('b');
  });

  it('findMovedIndices returns null when order is unchanged', () => {
    expect(findMovedIndices(items, items, (item) => item.playlistItemId)).toBeNull();
  });

  it('findMovedIndices detects a single moved item', () => {
    const reordered = reorderArray(items, 0, 2);
    expect(findMovedIndices(items, reordered, (item) => item.playlistItemId)).toEqual([0, 2]);
    expect(findMovedIndices(items, reorderArray(items, 2, 0), (item) => item.playlistItemId)).toEqual([2, 0]);
  });

  it('findMovedIndices returns null when lengths differ', () => {
    expect(findMovedIndices(items, items.slice(0, 2), (item) => item.playlistItemId)).toBeNull();
  });
});
