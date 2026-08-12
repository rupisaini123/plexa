import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TrackItem } from '../lib/api';
import * as motionLib from '../lib/motion';
import type { InfiniteMediaListState } from '../hooks/useInfiniteMediaList';
import { LibraryTracksList } from './LibraryTracksList';

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack: vi.fn(),
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

const virtualizerState = {
  visibleStart: 0,
  visibleEnd: Infinity as number,
  overscan: 2,
};

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => {
    const end = virtualizerState.visibleEnd === Infinity
      ? Math.max(count - 1, 0)
      : virtualizerState.visibleEnd;
    const start = virtualizerState.visibleStart;
    const renderStart = Math.max(0, start - virtualizerState.overscan);
    const renderEnd = Math.min(Math.max(count - 1, 0), end + virtualizerState.overscan);

    return {
      getVirtualItems: () => {
        if (count === 0) return [];
        return Array.from({ length: renderEnd - renderStart + 1 }, (_, offset) => {
          const index = renderStart + offset;
          return {
            index,
            start: index * 56,
            size: 56,
            key: index,
          };
        });
      },
      getTotalSize: () => count * 56,
      measureElement: vi.fn(),
      range: { startIndex: start, endIndex: end },
    };
  },
}));

const track: TrackItem = {
  ratingKey: '1',
  title: 'Neon Skyline',
  artist: 'Aurora',
  album: 'Night Drive',
  durationMs: 180000,
  artUrl: '/artwork/neon.png',
};

const revealKey = 'tracks:title';

function createTracksState(
  overrides: Partial<InfiniteMediaListState<TrackItem>> = {},
): InfiniteMediaListState<TrackItem> {
  return {
    items: [track],
    loading: false,
    loadingMore: false,
    error: '',
    hasMore: false,
    nextStart: 1,
    loadMore: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
    replaceItems: vi.fn(),
    ...overrides,
  };
}

function createTrackItems(count: number): TrackItem[] {
  return Array.from({ length: count }, (_, index) => ({
    ...track,
    ratingKey: String(index + 1),
    title: `Track ${index + 1}`,
  }));
}

function renderList(
  tracks: InfiniteMediaListState<TrackItem>,
  onPlayTrack = vi.fn(),
) {
  return render(
    <LibraryTracksList
      tracks={tracks}
      listMaxHeight="max-h-96"
      revealKey={revealKey}
      onPlayTrack={onPlayTrack}
    />,
  );
}

describe('LibraryTracksList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    virtualizerState.visibleStart = 0;
    virtualizerState.visibleEnd = Infinity;
    virtualizerState.overscan = 2;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders virtualized track rows', () => {
    renderList(createTracksState());

    expect(screen.getByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.getByText('Aurora · Night Drive')).toBeInTheDocument();
    expect(screen.getByTestId('library-tracks')).toHaveClass('max-h-96');
  });

  it('shows track content immediately when reduced motion is preferred', () => {
    renderList(createTracksState({
      items: [
        track,
        { ...track, ratingKey: '2', title: 'Second Light' },
      ],
    }));

    expect(screen.getByText('Neon Skyline')).toBeVisible();
    expect(screen.getByText('Second Light')).toBeVisible();
    expect(screen.queryByTestId('reveal-list-item')).not.toBeInTheDocument();
  });

  it('renders reveal wrappers when reduced motion is off', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    renderList(createTracksState());

    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();
  });

  it('calls onPlayTrack when play is clicked', async () => {
    const user = userEvent.setup();
    const onPlayTrack = vi.fn();
    renderList(createTracksState(), onPlayTrack);

    await user.click(screen.getByRole('button', { name: /Play Neon Skyline/i }));
    expect(onPlayTrack).toHaveBeenCalledWith(track);
  });

  it('loads more when the last visible row is near the end', () => {
    const loadMore = vi.fn();
    const items = createTrackItems(6);

    renderList(createTracksState({ items, hasMore: true, loadMore }));

    expect(loadMore).toHaveBeenCalled();
  });

  it('loads more when boundary button is clicked', async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn();

    renderList(createTracksState({ hasMore: true, loadMore }));

    await user.click(screen.getByRole('button', { name: /Load more/i }));
    expect(loadMore).toHaveBeenCalled();
  });

  it('shows end label when all tracks are loaded', () => {
    renderList(createTracksState({
      items: [track, { ...track, ratingKey: '2', title: 'Second' }],
    }));

    expect(screen.getByText('2 tracks loaded')).toBeInTheDocument();
  });

  it('staggers visible rows in top-to-bottom order', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    renderList(createTracksState({
      items: createTrackItems(3),
    }));

    const delays = screen.getAllByTestId('reveal-list-item').map(
      (element) => Number(element.getAttribute('data-stagger-delay')),
    );

    expect(delays).toEqual([
      0,
      motionLib.REVEAL_TRACK_STAGGER_STEP,
      motionLib.REVEAL_TRACK_STAGGER_STEP * 2,
    ]);
  });

  it('excludes overscan rows from reveal wrappers while keeping their content visible', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);
    virtualizerState.visibleStart = 2;
    virtualizerState.visibleEnd = 4;
    virtualizerState.overscan = 2;

    renderList(createTracksState({
      items: createTrackItems(10),
    }));

    const revealWrappers = screen.getAllByTestId('reveal-list-item');
    expect(revealWrappers).toHaveLength(3);
    expect(screen.getByText('Track 1')).toBeInTheDocument();
    expect(screen.getByText('Track 5')).toBeInTheDocument();
    expect(screen.getByText('Track 6')).toBeInTheDocument();
    expect(screen.getByText('Track 7')).toBeInTheDocument();
    expect(screen.queryByText('Track 8')).not.toBeInTheDocument();
  });

  it('restarts stagger at zero when the visible window jumps forward', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);
    virtualizerState.visibleStart = 0;
    virtualizerState.visibleEnd = 2;
    virtualizerState.overscan = 2;

    const items = createTrackItems(10);
    const { rerender } = renderList(createTracksState({ items }));

    expect(screen.getAllByTestId('reveal-list-item')).toHaveLength(3);

    virtualizerState.visibleStart = 5;
    virtualizerState.visibleEnd = 7;

    rerender(
      <LibraryTracksList
        tracks={createTracksState({ items })}
        listMaxHeight="max-h-96"
        revealKey={revealKey}
        onPlayTrack={vi.fn()}
      />,
    );

    const delays = screen.getAllByTestId('reveal-list-item').map(
      (element) => Number(element.getAttribute('data-stagger-delay')),
    );

    expect(delays).toEqual([
      0,
      motionLib.REVEAL_TRACK_STAGGER_STEP,
      motionLib.REVEAL_TRACK_STAGGER_STEP * 2,
    ]);
    expect(screen.getByText('Track 6')).toBeInTheDocument();
    expect(screen.queryByText('Track 1')).not.toBeInTheDocument();
  });

  it('animates newly appended tracks in a later batch', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    const initial = createTracksState({
      items: [track],
      hasMore: true,
    });
    const { rerender } = render(
      <LibraryTracksList
        tracks={initial}
        listMaxHeight="max-h-96"
        revealKey={revealKey}
        onPlayTrack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();

    rerender(
      <LibraryTracksList
        tracks={createTracksState({
          items: [
            track,
            { ...track, ratingKey: '2', title: 'Second Light' },
          ],
          hasMore: false,
        })}
        listMaxHeight="max-h-96"
        revealKey={revealKey}
        onPlayTrack={vi.fn()}
      />,
    );

    expect(screen.getAllByTestId('reveal-list-item')).toHaveLength(2);
    expect(screen.getByText('Second Light')).toBeInTheDocument();
  });

  it('keeps reveal wrappers through parent rerenders before reveal completes', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    const tracks = createTracksState();
    const { rerender } = render(
      <LibraryTracksList
        tracks={tracks}
        listMaxHeight="max-h-96"
        revealKey={revealKey}
        onPlayTrack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();

    rerender(
      <LibraryTracksList
        tracks={tracks}
        listMaxHeight="max-h-96"
        revealKey={revealKey}
        onPlayTrack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();
  });

  it('resets reveal wrappers when revealKey changes', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    const { rerender } = render(
      <LibraryTracksList
        tracks={createTracksState()}
        listMaxHeight="max-h-96"
        revealKey="tracks:title"
        onPlayTrack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();

    rerender(
      <LibraryTracksList
        tracks={createTracksState()}
        listMaxHeight="max-h-96"
        revealKey="tracks:addedAt"
        onPlayTrack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();
  });
});
