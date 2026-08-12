import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Reorder } from 'motion/react';
import { QueueTrackRow } from './QueueTrackRow';
import type { QueueUpNextItem } from './QueueTracksList';

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack: vi.fn(),
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

describe('QueueTrackRow', () => {
  const track = {
    ratingKey: '42',
    title: 'Neon Sky',
    artist: 'Aurora',
    album: 'Night Drive',
    durationMs: 210000,
  };

  const item: QueueUpNextItem = {
    track,
    queueIndex: 2,
  };

  const dragProps = {
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
    onPointerDrag: vi.fn(),
  };

  it('jumps to track on row click and exposes remove control', async () => {
    const user = userEvent.setup();
    const onJumpTo = vi.fn();
    const onRemove = vi.fn();

    render(
      <Reorder.Group axis="y" as="div" values={[item]} onReorder={() => undefined}>
        <QueueTrackRow
          item={item}
          dragProps={dragProps}
          onJumpTo={onJumpTo}
          onRemove={onRemove}
        />
      </Reorder.Group>,
    );

    await user.click(screen.getByRole('button', { name: 'Play Neon Sky' }));
    expect(onJumpTo).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Remove Neon Sky/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
