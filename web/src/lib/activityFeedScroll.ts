export function adjustScrollForPrependedRows(
  scrollEl: HTMLElement | null,
  previousScrollHeight: number,
): void {
  if (!scrollEl || previousScrollHeight <= 0) return;
  const delta = scrollEl.scrollHeight - previousScrollHeight;
  if (delta > 0) {
    scrollEl.scrollTop += delta;
  }
}
