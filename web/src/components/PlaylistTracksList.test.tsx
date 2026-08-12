import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaylistTracksList } from './PlaylistTracksList';
import type { TrackItem } from '../lib/api';
import type { InfiniteMediaListState } from '../hooks/useInfiniteMediaList';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: vi.fn(),
    fetchCsrf: vi.fn().mockResolvedValue('csrf'),
  };
});

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack: vi.fn(),
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

import { api } from '../lib/api';

const trackA: TrackItem = {
  ratingKey: '1',
  title: 'Neon Skyline',
  artist: 'Aurora',
  playlistItemId: 'item-1',
};

const trackB: TrackItem = {
  ratingKey: '2',
  title: 'Night Drive',
  artist: 'Aurora',
  playlistItemId: 'item-2',
};

function createTracksState(
  overrides: Partial<InfiniteMediaListState<TrackItem>> = {},
): InfiniteMediaListState<TrackItem> {
  return {
    items: [trackA, trackB],
    loading: false,
    loadingMore: false,
    error: '',
    hasMore: false,
    nextStart: 2,
    loadMore: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
    replaceItems: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistTracksList', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({});
  });

  it('renders track titles prominently', () => {
    render(
      <PlaylistTracksList
        playlistKey="pl1"
        tracks={createTracksState()}
        onPlayTrack={vi.fn()}
        onRemoveTrack={vi.fn()}
        onReorderError={vi.fn()}
      />,
    );

    expect(screen.getByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.getByText('Night Drive')).toBeInTheDocument();
  });

  it('loads more when the sentinel enters the scroll container', () => {
    const loadMore = vi.fn();

    render(
      <PlaylistTracksList
        playlistKey="pl1"
        tracks={createTracksState({ hasMore: true, loadMore })}
        onPlayTrack={vi.fn()}
        onRemoveTrack={vi.fn()}
        onReorderError={vi.fn()}
      />,
    );

    expect(screen.getByTestId('playlist-tracks-load-sentinel')).toBeInTheDocument();
    expect(loadMore).toHaveBeenCalled();
  });

  it('shows play and remove actions without hovering on desktop', () => {
    render(
      <PlaylistTracksList
        playlistKey="pl1"
        tracks={createTracksState()}
        onPlayTrack={vi.fn()}
        onRemoveTrack={vi.fn()}
        onReorderError={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Play Neon Skyline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Neon Skyline to playlist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Neon Skyline/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Drag to reorder/i })).toHaveLength(2);
  });

  it('does not remove track from list until parent confirms removal', async () => {
    const user = userEvent.setup();
    const onRemoveTrack = vi.fn();

    render(
      <PlaylistTracksList
        playlistKey="pl1"
        tracks={createTracksState()}
        onPlayTrack={vi.fn()}
        onRemoveTrack={onRemoveTrack}
        onReorderError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Remove Neon Skyline/i }));

    expect(onRemoveTrack).toHaveBeenCalledWith(trackA);
    expect(screen.getByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.getByText('Night Drive')).toBeInTheDocument();
  });

  it('loads more when boundary button is clicked', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();

    render(
      <PlaylistTracksList
        playlistKey="pl1"
        tracks={createTracksState({ hasMore: true, loadMore })}
        onPlayTrack={vi.fn()}
        onRemoveTrack={vi.fn()}
        onReorderError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Load more/i }));
    expect(loadMore).toHaveBeenCalled();
  });
});
