import { describe, it, expect } from 'vitest';
import { adjustScrollForPrependedRows } from './activityFeedScroll';

describe('adjustScrollForPrependedRows', () => {
  it('increases scrollTop by the scroll height delta', () => {
    const scrollEl = document.createElement('div');
    Object.defineProperty(scrollEl, 'scrollHeight', {
      configurable: true,
      get: () => 500,
    });
    scrollEl.scrollTop = 100;
    adjustScrollForPrependedRows(scrollEl, 380);
    expect(scrollEl.scrollTop).toBe(220);
  });

  it('does nothing when scroll height did not grow', () => {
    const scrollEl = document.createElement('div');
    Object.defineProperty(scrollEl, 'scrollHeight', {
      configurable: true,
      get: () => 400,
    });
    scrollEl.scrollTop = 100;
    adjustScrollForPrependedRows(scrollEl, 400);
    expect(scrollEl.scrollTop).toBe(100);
  });

  it('does nothing when previousScrollHeight is zero or element is null', () => {
    const scrollEl = document.createElement('div');
    Object.defineProperty(scrollEl, 'scrollHeight', {
      configurable: true,
      get: () => 500,
    });
    scrollEl.scrollTop = 50;
    adjustScrollForPrependedRows(scrollEl, 0);
    expect(scrollEl.scrollTop).toBe(50);
    adjustScrollForPrependedRows(null, 400);
    expect(scrollEl.scrollTop).toBe(50);
  });
});
