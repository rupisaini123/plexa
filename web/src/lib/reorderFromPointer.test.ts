import { describe, it, expect } from 'vitest';
import { reorderFromPointer } from './reorderFromPointer';

function mockRow(top: number, height = 48): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      top,
      height,
      bottom: top + height,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }),
  } as HTMLElement;
}

describe('reorderFromPointer', () => {
  const values = ['a', 'b', 'c'];
  const rows = new Map<string, HTMLElement>([
    ['a', mockRow(0)],
    ['b', mockRow(48)],
    ['c', mockRow(96)],
  ]);

  const getRowElement = (value: string) => rows.get(value) ?? null;

  it('returns null when order is unchanged', () => {
    expect(reorderFromPointer(values, 'b', 72, getRowElement)).toBeNull();
  });

  it('inserts before the first row when pointer is above its midpoint', () => {
    expect(reorderFromPointer(values, 'c', 20, getRowElement)).toEqual(['c', 'a', 'b']);
  });

  it('inserts after the last row when pointer is below all midpoints', () => {
    expect(reorderFromPointer(values, 'a', 200, getRowElement)).toEqual(['b', 'c', 'a']);
  });

  it('moves between rows based on midpoint crossing', () => {
    expect(reorderFromPointer(values, 'a', 80, getRowElement)).toEqual(['b', 'a', 'c']);
  });

  it('uses updated rects after fast scroll shifts row positions', () => {
    rows.set('a', mockRow(-200));
    rows.set('b', mockRow(-152));
    rows.set('c', mockRow(-104));

    expect(reorderFromPointer(values, 'c', -180, getRowElement)).toEqual(['c', 'a', 'b']);
  });

  it('returns null when dragged value is missing from order', () => {
    expect(reorderFromPointer(values, 'missing', 50, getRowElement)).toBeNull();
  });
});
