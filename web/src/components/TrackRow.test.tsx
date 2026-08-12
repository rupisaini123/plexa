import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TrackRow } from './TrackRow';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import type { TrackItem } from '../lib/api';

vi.mock('../context/PlaylistActionsContext', () => ({
  usePlaylistActions: () => ({
    openForTrack: vi.fn(),
    openForPlaylist: vi.fn(),
    revision: 0,
  }),
}));

const track: TrackItem = {
  ratingKey: '1',
  title: 'Neon Skyline',
  artist: 'Aurora',
  album: 'Night Drive',
  durationMs: 215000,
  artUrl: '/artwork/neon.png',
};

describe('TrackRow', () => {
  it('renders poster, metadata, duration, and play control', () => {
    const onPlay = vi.fn();
    render(<TrackRow track={track} onPlay={onPlay} />);

    const poster = screen.getByRole('presentation');
    expect(poster).toHaveAttribute('src', '/artwork/neon.png');
    expect(screen.getByText('Neon Skyline')).toBeInTheDocument();
    expect(screen.getByText('Aurora · Night Drive')).toBeInTheDocument();
    expect(screen.getByText('3:35')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Play Neon Skyline/i }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it('falls back when artwork is missing', () => {
    render(<TrackRow track={{ ...track, artUrl: undefined }} onPlay={() => undefined} />);
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    expect(screen.getByText('Neon Skyline')).toBeInTheDocument();
  });

  it('falls back when artwork fails to load', () => {
    render(<TrackRow track={track} onPlay={() => undefined} />);
    const poster = screen.getByRole('presentation');
    fireEvent.error(poster);
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('renders custom actions such as add to playlist', () => {
    render(
      <TrackRow
        track={track}
        onPlay={() => undefined}
        actions={<AddToPlaylistButton track={track} />}
      />,
    );

    expect(screen.getByRole('button', { name: /Add Neon Skyline to playlist/i })).toBeInTheDocument();
  });
});
