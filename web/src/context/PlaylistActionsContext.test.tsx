import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaylistActionsProvider } from './PlaylistActionsContext';
import type { TrackItem } from '../lib/api';

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    listAllPlaylists: vi.fn(),
    addTracksToPlaylist: vi.fn(),
    createPlaylistWithTracks: vi.fn(),
    fetchCsrf: vi.fn().mockResolvedValue('csrf'),
  };
});

import {
  addTracksToPlaylist,
  createPlaylistWithTracks,
  listAllPlaylists,
} from '../lib/api';

const track: TrackItem = {
  ratingKey: '101',
  title: 'Neon Skyline',
  artist: 'Aurora',
  album: 'Night Drive',
  artUrl: '/artwork/neon.png',
};

function Harness() {
  return (
    <PlaylistActionsProvider>
      <button type="button" id="launcher">Launch</button>
    </PlaylistActionsProvider>
  );
}

describe('PlaylistActionsProvider', () => {
  beforeEach(() => {
    vi.mocked(listAllPlaylists).mockReset();
    vi.mocked(addTracksToPlaylist).mockReset();
    vi.mocked(createPlaylistWithTracks).mockReset();
    vi.mocked(listAllPlaylists).mockResolvedValue([
      { ratingKey: 'pl1', title: 'Favorites', leafCount: 2 },
    ]);
    vi.mocked(addTracksToPlaylist).mockResolvedValue(undefined);
    vi.mocked(createPlaylistWithTracks).mockResolvedValue({
      ratingKey: 'pl-new',
      title: 'Road Trip',
      leafCount: 1,
    });
  });

  it('adds a track to an existing playlist from the destination dialog', async () => {
    const user = userEvent.setup();
    const { usePlaylistActions } = await import('./PlaylistActionsContext');

    function OpenDialog() {
      const { openForTrack } = usePlaylistActions();
      return (
        <button type="button" onClick={() => openForTrack(track)}>
          Open
        </button>
      );
    }

    render(
      <PlaylistActionsProvider>
        <OpenDialog />
      </PlaylistActionsProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.getByText('Favorites')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(addTracksToPlaylist).toHaveBeenCalledWith('pl1', ['101']);
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Added "Neon Skyline" to "Favorites"');
  });

  it('creates a playlist seeded with the selected track', async () => {
    const user = userEvent.setup();
    const { usePlaylistActions } = await import('./PlaylistActionsContext');

    function OpenDialog() {
      const { openForTrack } = usePlaylistActions();
      return (
        <button type="button" onClick={() => openForTrack(track)}>
          Open
        </button>
      );
    }

    render(
      <PlaylistActionsProvider>
        <OpenDialog />
      </PlaylistActionsProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('dialog');

    await user.type(screen.getByLabelText('New playlist name'), 'Road Trip');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(createPlaylistWithTracks).toHaveBeenCalledWith('Road Trip', ['101']);
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Created "Road Trip" with "Neon Skyline"');
  });

  it('shows Plex errors and keeps the dialog open', async () => {
    const user = userEvent.setup();
    vi.mocked(addTracksToPlaylist).mockRejectedValueOnce(new Error('Playlist not found'));
    const { usePlaylistActions } = await import('./PlaylistActionsContext');

    function OpenDialog() {
      const { openForTrack } = usePlaylistActions();
      return (
        <button type="button" onClick={() => openForTrack(track)}>
          Open
        </button>
      );
    }

    render(
      <PlaylistActionsProvider>
        <OpenDialog />
      </PlaylistActionsProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Playlist not found');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('restores focus to the launcher after closing with Escape', async () => {
    const user = userEvent.setup();
    const { usePlaylistActions } = await import('./PlaylistActionsContext');

    function OpenDialog() {
      const { openForTrack } = usePlaylistActions();
      return (
        <button type="button" onClick={() => openForTrack(track)}>
          Open
        </button>
      );
    }

    render(
      <PlaylistActionsProvider>
        <OpenDialog />
      </PlaylistActionsProvider>,
    );

    const launcher = screen.getByRole('button', { name: 'Open' });
    await user.click(launcher);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(launcher).toHaveFocus();
  });

  it('renders without crashing', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Launch' })).toBeInTheDocument();
  });
});
