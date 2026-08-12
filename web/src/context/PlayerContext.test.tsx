import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerProvider, usePlayer } from '../context/PlayerContext';

vi.mock('../lib/api', () => ({
  api: vi.fn(async (path: string, options?: RequestInit) => {
    if (path === '/api/player/queue' && options?.method === 'POST') {
      return {
        queue: {
          items: [
            { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1', durationMs: 180000, artUrl: '/artwork/1' },
            { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2', durationMs: 200000 },
          ],
          currentIndex: 0,
          shuffle: false,
        },
        current: { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1', durationMs: 180000, artUrl: '/artwork/1' },
      };
    }
    if (path === '/api/player/next') {
      return {
        queue: {
          items: [
            { ratingKey: '1', title: 'One', streamUrl: 'https://example.com/1' },
            { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' },
          ],
          currentIndex: 1,
          shuffle: false,
        },
        current: { ratingKey: '2', title: 'Two', streamUrl: 'https://example.com/2' },
      };
    }
    return { queue: null, current: null };
  }),
  fetchCsrf: vi.fn().mockResolvedValue('csrf'),
}));

type Listener = EventListenerOrEventListenerObject;

class FakeAudio {
  src = '';
  paused = true;
  currentTime = 0;
  duration = 180;
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string) {
    const event = new Event(type);
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

let fakeAudio: FakeAudio;
vi.stubGlobal('Audio', class {
  constructor() {
    fakeAudio = new FakeAudio();
    return fakeAudio;
  }
});

function Probe() {
  const player = usePlayer();
  return (
    <div>
      <p data-testid="current">{player.current?.title ?? 'none'}</p>
      <p data-testid="time">{Math.floor(player.currentTime)}</p>
      <p data-testid="duration">{Math.floor(player.duration)}</p>
      <button type="button" onClick={() => player.playTracks([{ ratingKey: '1', title: 'One' }, { ratingKey: '2', title: 'Two' }])}>
        Play
      </button>
      <button type="button" onClick={() => player.next()}>Next</button>
      <button type="button" onClick={() => player.seek(42)}>Seek</button>
    </div>
  );
}

describe('PlayerContext', () => {
  beforeEach(() => {
    fakeAudio = undefined as unknown as FakeAudio;
  });

  it('uses server-returned queue indices', async () => {
    const user = userEvent.setup();
    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByTestId('current')).toHaveTextContent('One');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByTestId('current')).toHaveTextContent('Two');
  });

  it('tracks currentTime and duration from audio events and supports seek', async () => {
    const user = userEvent.setup();
    render(
      <PlayerProvider>
        <Probe />
      </PlayerProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(await screen.findByTestId('current')).toHaveTextContent('One');

    await act(async () => {
      fakeAudio.duration = 180;
      fakeAudio.dispatch('loadedmetadata');
    });
    expect(screen.getByTestId('duration')).toHaveTextContent('180');

    await act(async () => {
      fakeAudio.currentTime = 25;
      fakeAudio.dispatch('timeupdate');
    });
    expect(screen.getByTestId('time')).toHaveTextContent('25');

    await user.click(screen.getByRole('button', { name: 'Seek' }));
    expect(fakeAudio.currentTime).toBe(42);
    expect(screen.getByTestId('time')).toHaveTextContent('42');
  });
});
