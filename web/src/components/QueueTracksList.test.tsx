import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueueTracksList } from './QueueTracksList';
import type { QueueUpNextItem } from './QueueTracksList';
import { reorderArray } from '../lib/reorderPlaylistTracks';

const items: QueueUpNextItem[] = [
  { track: { ratingKey: '1', title: 'Track One' }, queueIndex: 1 },
  { track: { ratingKey: '2', title: 'Track Two' }, queueIndex: 2 },
  { track: { ratingKey: '3', title: 'Track Three' }, queueIndex: 3 },
];

let latestDragProps: {
  onDragStart: () => void;
  onDragEnd: () => void;
  onPointerDrag: (clientY: number, value: string) => void;
} | null = null;
let latestReorderByValues: ((values: string[]) => void) | null = null;
let latestRemoveItem: ((key: string) => void) | null = null;

vi.mock('../hooks/useDragReorder', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useDragReorder')>('../hooks/useDragReorder');
  return {
    ...actual,
    useDragReorder: (
      sourceItems: QueueUpNextItem[],
      getKey: (item: QueueUpNextItem) => string,
      onCommit: (dragStart: QueueUpNextItem[], fromIndex: number, toIndex: number) => void,
      options?: { onRemoveItem?: (item: QueueUpNextItem) => void },
    ) => {
      const hook = actual.useDragReorder(sourceItems, getKey, onCommit, options);
      latestDragProps = hook.dragProps;
      latestReorderByValues = hook.reorderByValues;
      latestRemoveItem = hook.removeItem;
      return hook;
    },
  };
});

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack: vi.fn(),
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

describe('QueueTracksList', () => {
  beforeEach(() => {
    latestDragProps = null;
    latestReorderByValues = null;
    latestRemoveItem = null;
  });

  it('commits reorder only after drag ends, not during preview updates', () => {
    const onReorder = vi.fn();

    render(
      <QueueTracksList
        items={items}
        onJumpTo={vi.fn()}
        onRemove={vi.fn()}
        onReorder={onReorder}
      />,
    );

    expect(latestDragProps).not.toBeNull();
    expect(latestReorderByValues).not.toBeNull();

    act(() => {
      latestDragProps?.onDragStart();
      latestReorderByValues?.(reorderArray(items, 0, 1).map((item) => item.track.ratingKey));
      latestReorderByValues?.(reorderArray(items, 0, 2).map((item) => item.track.ratingKey));
    });

    expect(onReorder).not.toHaveBeenCalled();

    act(() => {
      latestDragProps?.onDragEnd();
    });

    expect(onReorder).toHaveBeenCalledOnce();
    expect(onReorder).toHaveBeenCalledWith(1, 3);
  });

  it('removes locally before calling parent onRemove', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <QueueTracksList
        items={items}
        onJumpTo={vi.fn()}
        onRemove={onRemove}
        onReorder={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Remove Track Two/i }));

    expect(latestRemoveItem).not.toBeNull();
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith(2);
  });

  it('calls onRemove with fresh queueIndex after prior delete reindexes items', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    const { rerender } = render(
      <QueueTracksList
        items={items}
        onJumpTo={vi.fn()}
        onRemove={onRemove}
        onReorder={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Remove Track Two/i }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith(2);

    const reindexed = [
      { track: { ratingKey: '1', title: 'Track One' }, queueIndex: 1 },
      { track: { ratingKey: '3', title: 'Track Three' }, queueIndex: 2 },
    ];

    rerender(
      <QueueTracksList
        items={reindexed}
        onJumpTo={vi.fn()}
        onRemove={onRemove}
        onReorder={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Remove Track Three/i }));
    expect(onRemove).toHaveBeenCalledTimes(2);
    expect(onRemove).toHaveBeenLastCalledWith(2);
  });
});
