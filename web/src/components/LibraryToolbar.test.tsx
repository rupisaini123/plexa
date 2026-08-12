import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LibraryToolbar } from './LibraryToolbar';

describe('LibraryToolbar', () => {
  const onTabChange = vi.fn();
  const onSortChange = vi.fn();
  const onViewChange = vi.fn();

  beforeEach(() => {
    onTabChange.mockReset();
    onSortChange.mockReset();
    onViewChange.mockReset();
  });

  it('renders icon tabs with correct aria-selected state', () => {
    render(
      <LibraryToolbar
        tab="artists"
        sort="title"
        view="grid"
        loadedCount={12}
        onTabChange={onTabChange}
        onSortChange={onSortChange}
        onViewChange={onViewChange}
      />,
    );

    expect(screen.getByRole('tab', { name: /artists/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /albums/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tab', { name: /tracks/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('12 items');
  });

  it('opens the sort menu and changes sort', async () => {
    const user = userEvent.setup();

    render(
      <LibraryToolbar
        tab="albums"
        sort="title"
        view="grid"
        loadedCount={3}
        onTabChange={onTabChange}
        onSortChange={onSortChange}
        onViewChange={onViewChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /sort/i }));
    expect(screen.getByRole('menu', { name: /sort options/i })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitemradio', { name: /year \(newest\)/i }));
    expect(onSortChange).toHaveBeenCalledWith('yearDesc');
  });

  it('hides the view toggle on the tracks tab', () => {
    render(
      <LibraryToolbar
        tab="tracks"
        sort="title"
        view="grid"
        loadedCount={5}
        onTabChange={onTabChange}
        onSortChange={onSortChange}
        onViewChange={onViewChange}
        onPlayAll={vi.fn()}
        onShuffle={vi.fn()}
      />,
    );

    expect(screen.queryByRole('group', { name: /view/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play all/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /shuffle/i })).toBeInTheDocument();
  });

  it('publishes the measured toolbar height as a CSS variable', () => {
    let resizeCallback: ResizeObserverCallback | null = null;
    const OriginalResizeObserver = globalThis.ResizeObserver;
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          resizeCallback = cb;
        }
        observe() {
          /* no-op */
        }
        disconnect() {
          /* no-op */
        }
        unobserve() {
          /* no-op */
        }
      },
    );

    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() {
        if ((this as HTMLElement).classList?.contains('library-toolbar')) {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            bottom: 52,
            right: 800,
            width: 800,
            height: 52,
            toJSON() {
              return {};
            },
          };
        }
        return originalGetBoundingClientRect.call(this);
      },
    });

    try {
      const { unmount } = render(
        <LibraryToolbar
          tab="artists"
          sort="title"
          view="grid"
          loadedCount={12}
          onTabChange={onTabChange}
          onSortChange={onSortChange}
          onViewChange={onViewChange}
        />,
      );

      expect(document.documentElement.style.getPropertyValue('--library-toolbar-height')).toBe('52px');

      act(() => {
        resizeCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
      });
      expect(document.documentElement.style.getPropertyValue('--library-toolbar-height')).toBe('52px');

      unmount();
      expect(document.documentElement.style.getPropertyValue('--library-toolbar-height')).toBe('3.25rem');
    } finally {
      if (OriginalResizeObserver) {
        vi.stubGlobal('ResizeObserver', OriginalResizeObserver);
      }
      Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
        configurable: true,
        value: originalGetBoundingClientRect,
      });
    }
  });
});
