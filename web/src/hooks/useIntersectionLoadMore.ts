import { useEffect, type RefObject } from 'react';

interface UseIntersectionLoadMoreOptions {
  rootRef: RefObject<Element | null>;
  targetRef: RefObject<Element | null>;
  enabled: boolean;
  busy: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

export function useIntersectionLoadMore({
  rootRef,
  targetRef,
  enabled,
  busy,
  onLoadMore,
  rootMargin = '240px 0px',
}: UseIntersectionLoadMoreOptions): void {
  useEffect(() => {
    const node = targetRef.current;
    if (!node || !enabled || busy) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      {
        root: rootRef.current ?? null,
        rootMargin,
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [busy, enabled, onLoadMore, rootMargin, rootRef, targetRef]);
}
