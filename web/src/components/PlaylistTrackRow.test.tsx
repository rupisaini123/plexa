import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Reorder } from 'motion/react';
import { PlaylistTrackRow } from './PlaylistTrackRow';
import type { TrackItem } from '../lib/api';

const openForTrack = vi.fn();

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack,
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

const track: TrackItem = {
  ratingKey: '1',
  title: 'Neon Skyline',
  artist: 'Aurora',
  playlistItemId: 'item-1',
};

function mockMatchMedia(compact: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query.includes('max-width: 639px') ? compact : query.includes('hover: hover'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

function renderRow(overrides: Partial<Parameters<typeof PlaylistTrackRow>[0]> = {}) {
  const props = {
    track,
    index: 1,
    sortable: true,
    dragProps: {
      onDragStart: vi.fn(),
      onDragEnd: vi.fn(),
      onPointerDrag: vi.fn(),
    },
    onPlay: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };

  return render(
    <Reorder.Group axis="y" as="div" values={[props.track]} onReorder={() => undefined}>
      <PlaylistTrackRow {...props} />
    </Reorder.Group>,
  );
}

describe('PlaylistTrackRow', () => {
  beforeEach(() => {
    openForTrack.mockReset();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('always renders the drag handle', () => {
    renderRow();
    expect(screen.getByRole('button', { name: /Drag to reorder/i })).toHaveClass('touch-none');
  });

  it('highlights the playing track row', () => {
    renderRow({ index: 3, isPlaying: true });
    const row = screen.getByRole('listitem');
    expect(row).toHaveClass('playlist-track-row-playing');
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(row).toHaveTextContent('3');
  });

  it('shows inline add and remove actions on desktop', () => {
    renderRow();

    expect(screen.getByRole('button', { name: /Play Neon Skyline/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Neon Skyline to playlist/i })).toHaveClass('player-icon-btn');
    expect(screen.getByRole('button', { name: /Remove Neon Skyline/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /More actions/i })).not.toBeInTheDocument();
  });

  it('shows play and overflow menu on compact screens', async () => {
    const user = userEvent.setup();
    mockMatchMedia(true);
    const onRemove = vi.fn();
    renderRow({ onRemove });

    expect(screen.getByRole('button', { name: /Play Neon Skyline/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Neon Skyline to playlist/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Neon Skyline/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /More actions/i }));
    const menu = screen.getByRole('menu', { name: /Actions for Neon Skyline/i });
    expect(menu).toBeInTheDocument();
    expect(menu).toHaveClass('bg-surface-elevated', 'fixed', 'z-[100]');
    expect(menu.parentElement).toBe(document.body);

    await user.click(screen.getByRole('menuitem', { name: /Add to playlist/i }));
    expect(openForTrack).toHaveBeenCalledWith(track);

    await user.click(screen.getByRole('button', { name: /More actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /Remove from playlist/i }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
