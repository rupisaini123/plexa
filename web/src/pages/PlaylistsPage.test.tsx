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

    const { rerender } = render(<PlaylistsPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Favorites/i })).toBeInTheDocument());

    const sidebar = screen.getByTestId('playlists-sidebar');
    expect(sidebar.className).toContain('self-start');
    expect(sidebar.className).toContain('lg:sticky');
    expect(sidebar.className).toContain('lg:top-6');
    expect(sidebar.parentElement?.className).toContain('items-start');

    await user.click(screen.getByRole('button', { name: /Favorites/i }));

    const tracks = await screen.findByTestId('playlist-tracks');
    expect(tracks.className).toContain('lg:overflow-y-auto');
    expect(tracks.className).toContain('lg:max-h-[calc(100vh-18rem)]');

    playerState.current = { ratingKey: '1', title: 'Neon Skyline' };
    rerender(<PlaylistsPage />);

    expect(screen.getByTestId('playlist-tracks').className).toContain('lg:max-h-[calc(100vh-26rem)]');
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
    await user.click(screen.getByRole('button', { name: /Load more/i }));
    expect(await screen.findByText('Track Two')).toBeInTheDocument();
  });

  it('removes a track via ConfirmDialog instead of window.confirm', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    vi.mocked(api).mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('/api/playlists') && !path.includes('/tracks')) {
        return {
          items: [{ ratingKey: 'pl1', title: 'Favorites', leafCount: 1 }],
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
    await user.click(await screen.findByRole('button', { name: /Remove Neon Skyline/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Remove track' })).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/api/playlists/pl1/tracks/item-1', { method: 'DELETE' });
    });

    confirmSpy.mockRestore();
  });
});
