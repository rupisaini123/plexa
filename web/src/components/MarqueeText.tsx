import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface MarqueeTextProps {
  text: string;
  className?: string;
  title?: string;
}

/**
 * Single-line text that scrolls like a ticker only when it overflows its container.
 * Short titles stay static; long titles animate. Respects prefers-reduced-motion via CSS.
 */
export function MarqueeText({ text, className = '', title }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;
    // 1px tolerance for subpixel rounding
    setOverflowing(textEl.scrollWidth > container.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    measure();

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [text, measure, overflowing]);

  return (
    <div
      ref={containerRef}
      className={`marquee ${overflowing ? 'marquee-overflow' : ''} ${className}`.trim()}
      title={title ?? text}
    >
      {overflowing ? (
        <div className="marquee-track">
          <span ref={textRef} className="marquee-segment">
            {text}
          </span>
          <span className="marquee-segment" aria-hidden="true">
            {text}
          </span>
        </div>
      ) : (
        <span ref={textRef} className="marquee-static">
          {text}
        </span>
      )}
    </div>
  );
}
