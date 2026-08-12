import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MarqueeText } from './MarqueeText';

describe('MarqueeText', () => {
  let resizeCallback: ResizeObserverCallback | null = null;
  let containerWidth = 200;
  let textWidth = 80;

  beforeEach(() => {
    resizeCallback = null;
    containerWidth = 200;
    textWidth = 80;

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
    // Restore prototype properties so other suites are unaffected
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete (HTMLElement.prototype as { scrollWidth?: unknown }).scrollWidth;
  });

  it('renders static text when content fits', () => {
    containerWidth = 200;
    textWidth = 80;
    render(<MarqueeText text="Short Title" className="font-medium" />);

    act(() => {
      resizeCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });

    expect(screen.getByText('Short Title')).toBeInTheDocument();
    expect(document.querySelector('.marquee')).not.toHaveClass('marquee-overflow');
    expect(document.querySelector('.marquee-static')).toBeInTheDocument();
    expect(document.querySelector('.marquee-track')).not.toBeInTheDocument();
  });

  it('enables ticker animation when content overflows', () => {
    containerWidth = 100;
    textWidth = 400;
    render(<MarqueeText text="An Extremely Long Track Title That Will Overflow" />);

    act(() => {
      resizeCallback?.([] as unknown as ResizeObserverEntry[], {} as ResizeObserver);
    });

    const container = document.querySelector('.marquee');
    expect(container).toHaveClass('marquee-overflow');
    expect(document.querySelector('.marquee-track')).toBeInTheDocument();

    // Visible segment + aria-hidden duplicate for seamless loop
    const segments = document.querySelectorAll('.marquee-segment');
    expect(segments).toHaveLength(2);
    expect(segments[1]).toHaveAttribute('aria-hidden', 'true');
  });

  it('sets title attribute for full text on hover', () => {
    render(<MarqueeText text="Neon Skyline" />);
    expect(document.querySelector('.marquee')).toHaveAttribute('title', 'Neon Skyline');
  });
});
