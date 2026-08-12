import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaylistsPage } from './PlaylistsPage';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: vi.fn(),
    fetchCsrf: vi.fn().mockResolvedValue('csrf'),
  };
});

const playerState = {
  current: null as { ratingKey: string; title: string } | null,
  playTracks: vi.fn(),
};

vi.mock('../context/PlayerContext', () => ({
  usePlayer: () => playerState,
}));

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack: vi.fn(),
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

import { api } from '../lib/api';

describe('PlaylistsPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    playerState.current = null;
    playerState.playTracks.mockReset();
  });

  it('shows unselected empty state with create prompt', async () => {
    vi.mocked(api).mockResolvedValue({
      items: [{ ratingKey: 'pl1', title: 'Favorites', leafCount: 2 }],
      nextStart: 1,
      hasMore: false,
    });

    render(<PlaylistsPage />);

    expect(await screen.findByRole('heading', { name: 'Choose a playlist' })).toBeInTheDocument();
    expect(screen.getByText(/Select a playlist from the rail/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Create playlist' }).length).toBeGreaterThan(0);
  });

  it('filters playlists in the rail', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValue({
      items: [
        { ratingKey: 'pl1', title: 'Favorites', leafCount: 2 },
        { ratingKey: 'pl2', title: 'Road Trip', leafCount: 5 },
      ],
      nextStart: 2,
      hasMore: false,
    });

    render(<PlaylistsPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Favorites/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Road Trip/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Filter playlists'), 'road');

    expect(screen.queryByRole('button', { name: /Favorites/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Road Trip/i })).toBeInTheDocument();
  });

  it('shows poster artwork for playlist tracks when artUrl exists', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/playlists') && !path.includes('/tracks')) {
        return {
          items: [{ ratingKey: 'pl1', title: 'Favorites', leafCount: 2 }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.includes('/api/playlists/pl1/tracks')) {
        return {
          items: [
            {
              ratingKey: '1',
              title: 'Neon Skyline',
              artist: 'Aurora',
              playlistItemId: 'item-1',
              artUrl: '/artwork/neon.png',
            },
            {
              ratingKey: '2',
              title: 'No Cover',
              artist: 'Unknown',
              playlistItemId: 'item-2',
            },
          ],
          nextStart: 2,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<PlaylistsPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Favorites/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Favorites/i }));

    expect(await screen.findByText('Neon Skyline')).toBeInTheDocument();
    const posters = screen.getAllByRole('presentation');
    expect(posters.some((img) => img.getAttribute('src') === '/artwork/neon.png')).toBe(true);
    expect(screen.getByText('No Cover')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Play Neon Skyline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Neon Skyline to playlist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove Neon Skyline/i })).toBeInTheDocument();
  });

  it('keeps playlist sidebar sticky and scrolls tracks independently on large screens', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/playlists') && !path.includes('/tracks')) {
        return {
          items: [{ ratingKey: 'pl1', title: 'Favorites', leafCount: 1 }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.includes('/api/playlists/pl1/tracks')) {
        return {
          items: [
            {
              ratingKey: '1',
              title: 'Neon Skyline',
              artist: 'Aurora',
              playlistItemId: 'item-1',
            },
          ],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const { container, rerender } = render(<PlaylistsPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Favorites/i })).toBeInTheDocument());

    const sidebar = screen.getByTestId('playlists-sidebar');
    expect(sidebar.className).toContain('playlist-sidebar');
    expect(sidebar.parentElement?.className).toContain('playlist-split');

    await user.click(screen.getByRole('button', { name: /Favorites/i }));

    const tracks = await screen.findByTestId('playlist-tracks');
    expect(tracks.className).toContain('playlist-tracks-scroll');
    expect(container.querySelector('.playlist-detail-player-active')).toBeNull();

    playerState.current = { ratingKey: '1', title: 'Neon Skyline' };
    rerender(<PlaylistsPage />);

    expect(container.querySelector('.playlist-detail-player-active')).toBeTruthy();
  });

  it('highlights the currently playing track row', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/playlists') && !path.includes('/tracks')) {
        return {
          items: [{ ratingKey: 'pl1', title: 'Favorites', leafCount: 1 }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.includes('/api/playlists/pl1/tracks')) {
        return {
          items: [
            {
              ratingKey: '1',
              title: 'Neon Skyline',
              artist: 'Aurora',
              playlistItemId: 'item-1',
            },
          ],
          nextStart: 1,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    playerState.current = { ratingKey: '1', title: 'Neon Skyline' };
    render(<PlaylistsPage />);

    await user.click(await screen.findByRole('button', { name: /Favorites/i }));

    await waitFor(() => {
      expect(document.querySelector('.playlist-track-row-playing')).toBeTruthy();
    });
    const playingRow = document.querySelector('.playlist-track-row-playing');
    expect(playingRow).toHaveTextContent('Neon Skyline');
    expect(playingRow).toHaveAttribute('aria-current', 'true');
  });

  it('paginates playlist tracks with load more', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string) => {
      if (path.startsWith('/api/playlists') && !path.includes('/tracks')) {
        return {
          items: [{ ratingKey: 'pl1', title: 'Favorites', leafCount: 2 }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.includes('/tracks') && path.includes('start=0')) {
        return {
          items: [{ ratingKey: '1', title: 'Track One', playlistItemId: 'item-1' }],
          nextStart: 1,
          hasMore: true,
        };
      }
      if (path.includes('/tracks') && path.includes('start=1')) {
        return {
          items: [{ ratingKey: '2', title: 'Track Two', playlistItemId: 'item-2' }],
          nextStart: 2,
          hasMore: false,
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<PlaylistsPage />);
    await user.click(await screen.findByRole('button', { name: /Favorites/i }));
    expect(await screen.findByText('Track One')).toBeInTheDocument();
    expect(await screen.findByText('Track Two')).toBeInTheDocument();
  });

  it('removes a track via ConfirmDialog instead of window.confirm', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    let trackFetchCount = 0;
    vi.mocked(api).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/api/playlists') && !path.includes('/tracks')) {
        return {
          items: [{ ratingKey: 'pl1', title: 'Favorites', leafCount: 1, duration: 300000 }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.includes('/api/playlists/pl1/tracks') && path.includes('start=')) {
        trackFetchCount += 1;
        return {
          items: [
            {
              ratingKey: '1',
              title: 'Neon Skyline',
              artist: 'Aurora',
              playlistItemId: 'item-1',
              durationMs: 180000,
            },
          ],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path === '/api/playlists/pl1/tracks/item-1' && init?.method === 'DELETE') {
        return {};
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<PlaylistsPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Favorites/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Favorites/i }));
    await screen.findByText('Neon Skyline');
    expect(screen.getByText('1 track · 5 min')).toBeInTheDocument();
    const trackFetchesBeforeRemove = trackFetchCount;

    await user.click(await screen.findByRole('button', { name: /Remove Neon Skyline/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Remove track' })).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/api/playlists/pl1/tracks/item-1', { method: 'DELETE' });
    });
    expect(screen.queryByText('Neon Skyline')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading tracks')).not.toBeInTheDocument();
    expect(screen.queryByText('5 min')).not.toBeInTheDocument();
    expect(trackFetchCount).toBe(trackFetchesBeforeRemove);
    expect(screen.getByRole('button', { name: /Favorites/i })).toHaveTextContent('Empty');

    confirmSpy.mockRestore();
  });

  it('updates playlist total duration when removing a track', async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/api/playlists') && !path.includes('/tracks')) {
        return {
          items: [{ ratingKey: 'pl1', title: 'Favorites', leafCount: 2, duration: 300000 }],
          nextStart: 1,
          hasMore: false,
        };
      }
      if (path.includes('/api/playlists/pl1/tracks') && path.includes('start=')) {
        return {
          items: [
            {
              ratingKey: '1',
              title: 'Neon Skyline',
              artist: 'Aurora',
              playlistItemId: 'item-1',
              durationMs: 180000,
            },
            {
              ratingKey: '2',
              title: 'Midnight Drive',
              artist: 'Aurora',
              playlistItemId: 'item-2',
              durationMs: 120000,
            },
          ],
          nextStart: 2,
          hasMore: false,
        };
      }
      if (path === '/api/playlists/pl1/tracks/item-1' && init?.method === 'DELETE') {
        return {};
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    render(<PlaylistsPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Favorites/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Favorites/i }));
    await screen.findByText('Neon Skyline');
    expect(screen.getByText('2 tracks · 5 min')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Remove Neon Skyline/i }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(screen.queryByText('Neon Skyline')).not.toBeInTheDocument();
    });
    expect(screen.getByText('1 track · 2 min')).toBeInTheDocument();
    expect(screen.queryByText('5 min')).not.toBeInTheDocument();
  });
});
