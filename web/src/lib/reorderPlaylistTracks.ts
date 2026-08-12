export interface PlaylistReorderItem {
  playlistItemId?: string;
}

export function reorderArray<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/** Returns [fromIndex, toIndex] in the old array, or null if order is unchanged. */
export function findMovedIndices<T>(
  oldItems: T[],
  newItems: T[],
  getKey: (item: T) => string,
): [number, number] | null {
  if (oldItems.length !== newItems.length) return null;

  for (let fromIndex = 0; fromIndex < oldItems.length; fromIndex += 1) {
    for (let toIndex = 0; toIndex < oldItems.length; toIndex += 1) {
      if (fromIndex === toIndex) continue;
      const candidate = reorderArray(oldItems, fromIndex, toIndex);
      const matches = candidate.every(
        (item, index) => getKey(item) === getKey(newItems[index]),
      );
      if (matches) {
        return [fromIndex, toIndex];
      }
    }
  }

  return null;
}

/** Item immediately before `toIndex` in the reordered list (undefined = move to top). */
export function afterPlaylistItemId<T extends PlaylistReorderItem>(
  items: T[],
  toIndex: number,
): string | undefined {
  if (toIndex <= 0) return undefined;
  return items[toIndex - 1]?.playlistItemId;
}
