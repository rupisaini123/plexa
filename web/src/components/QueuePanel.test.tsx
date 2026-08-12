import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueuePanel } from './QueuePanel';
import { PlayerProvider, usePlayer } from '../context/PlayerContext';

const openForTrack = vi.fn();

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack,
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    api: vi.fn(async (path: string, options?: RequestInit) => {
      if (path === '/api/player/queue' && options?.method === 'POST') {
        const body = JSON.parse(String(options.body ?? '{}')) as {
          tracks?: Array<{ ratingKey: string; title: string; artist?: string }>;
        };
        const tracks = body.tracks ?? [];
        return {
          queue: { items: tracks, currentIndex: 0, shuffle: false },
          current: tracks[0] ?? null,
        };
      }
      return { queue: null, current: null };
    }),
    fetchCsrf: vi.fn().mockResolvedValue('csrf'),
  };
});

class FakeAudio {
  src = '';
  paused = true;
  currentTime = 0;
  duration = 0;
  addEventListener() {}
  removeEventListener() {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

vi.stubGlobal('Audio', class {
  constructor() {
    return new FakeAudio();
  }
});

function SeedQueue() {
  const player = usePlayer();
  return (
    <button
      type="button"
      onClick={() => {
        player.setShowQueue(true);
        void player.playTracks([
          { ratingKey: '1', title: 'Track One', artist: 'Aurora' },
          { ratingKey: '2', title: 'Track Two', artist: 'Band' },
        ]);
      }}
    >
      Seed queue
    </button>
  );
}

describe('QueuePanel', () => {
  beforeEach(() => {
    openForTrack.mockReset();
  });

  it('exposes add-to-playlist for each queue item without nesting buttons', async () => {
    const user = userEvent.setup();

    render(
      <PlayerProvider>
        <SeedQueue />
        <QueuePanel />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Seed queue' }));
    expect(await screen.findByRole('dialog', { name: 'Playback queue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Track One to playlist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Track Two to playlist/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add Track Two to playlist/i }));
    expect(openForTrack).toHaveBeenCalledWith(expect.objectContaining({
      ratingKey: '2',
      title: 'Track Two',
    }));
  });
});
