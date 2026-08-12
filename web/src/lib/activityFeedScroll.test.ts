import { describe, it, expect } from 'vitest';
import { adjustScrollForPrependedRows } from './activityFeedScroll';

describe('adjustScrollForPrependedRows', () => {
  it('increases scrollTop by added rows times row height', () => {
    const scrollEl = document.createElement('div');
    scrollEl.scrollTop = 100;
    adjustScrollForPrependedRows(scrollEl, 3, 44);
    expect(scrollEl.scrollTop).toBe(232);
  });

  it('does nothing when addedCount is zero or element is null', () => {
    const scrollEl = document.createElement('div');
    scrollEl.scrollTop = 50;
    adjustScrollForPrependedRows(scrollEl, 0, 44);
    expect(scrollEl.scrollTop).toBe(50);
    adjustScrollForPrependedRows(null, 2, 44);
    expect(scrollEl.scrollTop).toBe(50);
  });
});
