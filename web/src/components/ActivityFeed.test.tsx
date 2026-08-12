import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityFeed } from './ActivityFeed';

const mockState = {
  items: [] as { id: number; event_type: string; summary: string; created_at: string }[],
  loading: false,
  loadingMore: false,
  error: '',
  hasMore: false,
  nextStart: 0,
  loadMore: vi.fn(),
  retry: vi.fn(),
};

vi.mock('../hooks/useInfiniteAlexaEvents', () => ({
  useInfiniteAlexaEvents: () => mockState,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({
      index,
      start: index * 44,
      size: 44,
      key: index,
    })),
    getTotalSize: () => count * 44,
    measureElement: vi.fn(),
  }),
}));

describe('ActivityFeed', () => {
  beforeEach(() => {
    mockState.items = [];
    mockState.loading = false;
    mockState.loadingMore = false;
    mockState.error = '';
    mockState.hasMore = false;
    mockState.loadMore.mockReset();
    mockState.retry.mockReset();
  });

  it('shows loading state before first page', () => {
    mockState.loading = true;
    render(<ActivityFeed />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading activity')).toHaveClass('sr-only');
  });

  it('renders virtualized activity rows', () => {
    mockState.items = [
      { id: 1, event_type: 'LaunchRequest', summary: 'Opened Plexa', created_at: '2026-08-12 03:27:19' },
      { id: 2, event_type: 'PlayPlaylistIntent', summary: 'Playing playlist "Road Trip" (42 tracks)', created_at: '2026-08-12 03:26:19' },
    ];
    render(<ActivityFeed />);
    expect(screen.getByText('Opened Plexa')).toBeInTheDocument();
    expect(screen.getByText('Playing playlist "Road Trip" (42 tracks)')).toBeInTheDocument();
  });

  it('wraps long summary text for small screens', () => {
    mockState.items = [
      {
        id: 1,
        event_type: 'PlaybackFinished',
        summary: 'Finished "SHABAD HAZARE (BHAI RAVINDER SINGH)" by Various Artists',
        created_at: '2026-08-12 03:27:19',
      },
    ];
    render(<ActivityFeed />);
    const summary = screen.getByText('Finished "SHABAD HAZARE (BHAI RAVINDER SINGH)" by Various Artists');
    expect(summary).toHaveClass('min-w-0', 'break-words');
  });

  it('loads more when boundary button is clicked', async () => {
    const user = userEvent.setup();
    mockState.items = [{ id: 1, event_type: 'LaunchRequest', summary: 'Opened Plexa', created_at: '2026-08-12 03:27:19' }];
    mockState.hasMore = true;
    render(<ActivityFeed />);
    await user.click(screen.getByRole('button', { name: /Load more activity/i }));
    expect(mockState.loadMore).toHaveBeenCalled();
  });
});
