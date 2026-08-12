import { useEffect, useRef, type RefObject } from 'react';

interface InfiniteListBoundaryProps {
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error?: string;
  onLoadMore: () => void;
  onRetry?: () => void;
  rootRef?: RefObject<Element | null>;
  label?: string;
  endLabel?: string;
  className?: string;
}

export function InfiniteListBoundary({
  hasMore,
  loading,
  loadingMore,
  error,
  onLoadMore,
  onRetry,
  rootRef,
  label = 'Load more',
  endLabel,
  className = '',
}: InfiniteListBoundaryProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const busy = loading || loadingMore;

  useEffect(() => {
    const node = buttonRef.current;
    if (!node || !hasMore || busy || error) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      {
        root: rootRef?.current ?? null,
        rootMargin: '240px 0px',
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [busy, error, hasMore, onLoadMore, rootRef]);

  if (error) {
    return (
      <div className={`flex flex-col items-center gap-2 py-4 ${className}`}>
        <p className="text-sm text-danger" role="alert">{error}</p>
        <button
          ref={buttonRef}
          type="button"
          className="btn btn-secondary"
          onClick={onRetry ?? onLoadMore}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!hasMore) {
    if (!endLabel) return null;
    return (
      <p className={`py-3 text-center text-sm text-muted ${className}`} role="status">
        {endLabel}
      </p>
    );
  }

  return (
    <div className={`flex justify-center py-4 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-secondary min-w-[8rem]"
        onClick={onLoadMore}
        disabled={busy}
        aria-busy={busy}
      >
        {loadingMore ? 'Loading…' : label}
      </button>
    </div>
  );
}
