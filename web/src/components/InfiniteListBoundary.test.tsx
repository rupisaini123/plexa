import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfiniteListBoundary } from './InfiniteListBoundary';

describe('InfiniteListBoundary', () => {
  it('shows load more and calls onLoadMore when clicked', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <InfiniteListBoundary
        hasMore
        loading={false}
        loadingMore={false}
        onLoadMore={onLoadMore}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Load more/i }));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it('shows retry when errored', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <InfiniteListBoundary
        hasMore
        loading={false}
        loadingMore={false}
        error="boom"
        onLoadMore={() => undefined}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
    await user.click(screen.getByRole('button', { name: /Retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders end label when exhausted', () => {
    render(
      <InfiniteListBoundary
        hasMore={false}
        loading={false}
        loadingMore={false}
        onLoadMore={() => undefined}
        endLabel="12 tracks loaded"
      />,
    );
    expect(screen.getByText('12 tracks loaded')).toBeInTheDocument();
  });
});
