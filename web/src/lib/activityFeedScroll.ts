export function adjustScrollForPrependedRows(
  scrollEl: HTMLElement | null,
  addedCount: number,
  rowHeight: number,
): void {
  if (!scrollEl || addedCount <= 0) return;
  scrollEl.scrollTop += addedCount * rowHeight;
}
