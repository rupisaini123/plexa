export function reorderFromPointer(
  values: string[],
  draggedValue: string,
  clientY: number,
  getRowElement: (value: string) => HTMLElement | null,
): string[] | null {
  if (!values.includes(draggedValue)) return null;

  const remaining = values.filter((value) => value !== draggedValue);
  let insertAt = remaining.length;

  for (let i = 0; i < remaining.length; i += 1) {
    const element = getRowElement(remaining[i]);
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    if (clientY < midpoint) {
      insertAt = i;
      break;
    }
  }

  const next = [
    ...remaining.slice(0, insertAt),
    draggedValue,
    ...remaining.slice(insertAt),
  ];

  if (next.length === values.length && next.every((value, index) => value === values[index])) {
    return null;
  }

  return next;
}
