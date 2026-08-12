import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MediaCard } from './MediaCard';
import type { TrackItem } from '../lib/api';

const album: TrackItem = {
  ratingKey: 'al1',
  title: 'An Extremely Long Album Title That Needs A Ticker',
  artist: 'Aurora',
  year: 2024,
  artUrl: '/artwork/album.png',
};

describe('MediaCard', () => {
  let resizeCallback: ResizeObserverCallback | null = null;
  let containerWidth = 120;
  let textWidth = 420;

  beforeEach(() => {
    resizeCallback = null;
    containerWidth = 120;
    textWidth = 420;

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

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (this.classList.contains('marquee')) return containerWidth;
        return 0;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get(this: HTMLElement) {
        if (
          this.classList.contains('marquee-static')
          || this.classList.contains('marquee-segment')
        ) {
          return textWidth;
        }
        return 0;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth;
  });

  it('keeps the compact play control visible and activates marquee for long titles', () => {
    const onOpen = vi.fn();
    const onPlay = vi.fn();
    const { container } = render(
      <div style={{ width: 280 }}>
        <MediaCard
          item={album}
          kind="album"
          density="compact"
          onOpen={onOpen}
          onPlay={onPlay}
        />
      </div>,
    );

    act(() => {
      resizeCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });

    const card = container.querySelector('.media-card-compact');
    expect(card).toBeTruthy();

    const play = screen.getByRole('button', { name: /Play An Extremely Long Album Title/i });
    expect(play).toBeInTheDocument();
    expect(play.className).toContain('shrink-0');
    expect(play.className).toContain('media-card-play');

    expect(document.querySelector('.marquee')).toHaveClass('marquee-overflow');
    expect(document.querySelector('.marquee-track')).toBeInTheDocument();
    expect(screen.getByText('Aurora · 2024')).toBeInTheDocument();

    fireEvent.click(play);
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it('uses marquee for comfortable titles when they overflow', () => {
    const { container } = render(
      <div style={{ width: 160 }}>
        <MediaCard
          item={album}
          kind="album"
          density="comfortable"
          onOpen={() => undefined}
        />
      </div>,
    );

    act(() => {
      resizeCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });

    expect(container.querySelector('.marquee')).toHaveClass('marquee-overflow');
    expect(container.querySelector('.marquee-track')).toBeInTheDocument();
    expect(screen.getByText('Aurora · 2024')).toBeInTheDocument();
  });
});