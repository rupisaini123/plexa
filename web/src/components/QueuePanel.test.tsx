import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueuePanel } from './QueuePanel';
import { PlayerProvider, usePlayer } from '../context/PlayerContext';

const openForTrack = vi.fn();

const mockQueueTracks = [
  { ratingKey: '1', title: 'Track One', artist: 'Aurora' },
  { ratingKey: '2', title: 'Track Two', artist: 'Band' },
  { ratingKey: '3', title: 'Track Three', artist: 'Choir' },
  { ratingKey: '4', title: 'Track Four', artist: 'Duo' },
  { ratingKey: '5', title: 'Track Five', artist: 'Echo' },
  { ratingKey: '6', title: 'Track Six', artist: 'Folk' },
];

let mockCurrentIndex = 0;

function mockQueueResponse() {
  return {
    queue: {
      items: mockQueueTracks,
      currentIndex: mockCurrentIndex,
      shuffle: false,
      loop: false,
    },
    current: mockQueueTracks[mockCurrentIndex] ?? null,
  };
}

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
        mockQueueTracks.splice(0, mockQueueTracks.length, ...tracks);
        mockCurrentIndex = 0;
        return {
          queue: { items: tracks, currentIndex: 0, shuffle: false, loop: false },
          current: tracks[0] ?? null,
        };
      }
      if (path === '/api/player/jump' && options?.method === 'POST') {
        const body = JSON.parse(String(options.body ?? '{}')) as { index?: number };
        if (body.index !== undefined) {
          mockCurrentIndex = body.index;
        }
        return mockQueueResponse();
      }
      if (path === '/api/player/queue/clear' && options?.method === 'POST') {
        mockQueueTracks.splice(0, mockQueueTracks.length);
        mockCurrentIndex = 0;
        return { queue: null, current: null };
      }
      if (path === '/api/player/queue/shuffle' && options?.method === 'POST') {
        const body = JSON.parse(String(options.body ?? '{}')) as { enabled?: boolean };
        return {
          queue: {
            items: mockQueueTracks.slice(0, 2),
            currentIndex: 0,
            shuffle: Boolean(body.enabled),
            loop: false,
          },
          current: mockQueueTracks[0],
        };
      }
      return { queue: null, current: null };
    }),
    fetchCsrf: vi.fn().mockResolvedValue('csrf'),
  };
});

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack,
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

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
  removeAttribute() {}
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

function SeedLargeQueueAndJump() {
  const player = usePlayer();
  return (
    <button
      type="button"
      onClick={async () => {
        player.setShowQueue(true);
        await player.playTracks(mockQueueTracks);
        await player.jumpTo(4);
      }}
    >
      Jump to fifth track
    </button>
  );
}

function OpenEmptyQueue() {
  const player = usePlayer();
  return (
    <button type="button" onClick={() => player.setShowQueue(true)}>
      Open empty queue
    </button>
  );
}

describe('QueuePanel', () => {
  beforeEach(() => {
    openForTrack.mockReset();
    mockCurrentIndex = 0;
    mockQueueTracks.splice(0, mockQueueTracks.length,
      { ratingKey: '1', title: 'Track One', artist: 'Aurora' },
      { ratingKey: '2', title: 'Track Two', artist: 'Band' },
      { ratingKey: '3', title: 'Track Three', artist: 'Choir' },
      { ratingKey: '4', title: 'Track Four', artist: 'Duo' },
      { ratingKey: '5', title: 'Track Five', artist: 'Echo' },
      { ratingKey: '6', title: 'Track Six', artist: 'Folk' },
    );
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
    expect(await screen.findByRole('dialog', { name: 'Queue' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Track One to playlist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Track Two to playlist/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add Track Two to playlist/i }));
    expect(openForTrack).toHaveBeenCalledWith(expect.objectContaining({
      ratingKey: '2',
      title: 'Track Two',
    }));
  });

  it('shows empty state when queue panel opens with no tracks', async () => {
    const user = userEvent.setup();

    render(
      <PlayerProvider>
        <OpenEmptyQueue />
        <QueuePanel />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open empty queue' }));
    expect(await screen.findByRole('dialog', { name: 'Queue' })).toBeInTheDocument();
    expect(screen.getByText('Your queue is empty')).toBeInTheDocument();
  });

  it('renders shuffle and loop controls in the header', async () => {
    const user = userEvent.setup();

    render(
      <PlayerProvider>
        <SeedQueue />
        <QueuePanel />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Seed queue' }));
    expect(await screen.findByRole('button', { name: 'Enable shuffle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable loop' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Now playing' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Up next' })).toBeInTheDocument();
  });

  it('does not render album/time column headers', async () => {
    const user = userEvent.setup();

    render(
      <PlayerProvider>
        <SeedQueue />
        <QueuePanel />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Seed queue' }));
    await screen.findByRole('region', { name: 'Up next' });

    expect(screen.queryByText('Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Album')).not.toBeInTheDocument();
    expect(screen.queryByText('Time')).not.toBeInTheDocument();
  });

  it('pins clear queue in the panel footer outside the scroll area', async () => {
    const user = userEvent.setup();

    render(
      <PlayerProvider>
        <SeedQueue />
        <QueuePanel />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Seed queue' }));
    const footer = await screen.findByTestId('queue-panel-footer');
    const scroll = screen.getByTestId('queue-panel-scroll');
    const pinned = screen.getByTestId('queue-panel-pinned');
    const clearButton = screen.getByRole('button', { name: 'Clear queue' });
    const nowPlaying = screen.getByRole('region', { name: 'Now playing' });
    const upNext = screen.getByRole('region', { name: 'Up next' });

    expect(footer).toContainElement(clearButton);
    expect(footer).not.toHaveClass('sticky');
    expect(pinned).toContainElement(nowPlaying);
    expect(upNext).toContainElement(scroll);
    expect(scroll).not.toContainElement(nowPlaying);
    expect(footer).not.toHaveClass('queue-panel-footer-compact');
  });

  it('positions compact sheet above player bar without footer offset', async () => {
    const matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 639px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.stubGlobal('matchMedia', matchMedia);

    const user = userEvent.setup();

    render(
      <PlayerProvider>
        <SeedQueue />
        <QueuePanel />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Seed queue' }));
    const panel = await screen.findByRole('dialog', { name: 'Queue' });
    const footer = screen.getByTestId('queue-panel-footer');

    expect(panel).toHaveClass('queue-panel-compact');
    expect(panel.className).toContain('bottom-[var(--player-bar-offset,0px)]');
    expect(footer).not.toHaveClass('queue-panel-footer-compact');
  });

  it('removes skipped tracks from up next after jumping ahead', async () => {
    const user = userEvent.setup();

    render(
      <PlayerProvider>
        <SeedLargeQueueAndJump />
        <QueuePanel />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Jump to fifth track' }));

    const upNext = await screen.findByRole('region', { name: 'Up next' });
    expect(screen.getByRole('region', { name: 'Now playing' })).toHaveTextContent('Track Five');
    expect(upNext).toHaveTextContent('Track Six');
    expect(upNext).not.toHaveTextContent('Track Two');
    expect(upNext).not.toHaveTextContent('Track Three');
    expect(upNext).not.toHaveTextContent('Track Four');
    expect(screen.getAllByRole('button', { name: /Play Track Six/i })).toHaveLength(1);
  });

  it('wires queue panel id for player bar aria-controls', async () => {
    const user = userEvent.setup();

    render(
      <PlayerProvider>
        <OpenEmptyQueue />
        <QueuePanel />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open empty queue' }));
    expect(await screen.findByRole('dialog', { name: 'Queue' })).toHaveAttribute('id', 'queue-panel');
  });
});
