import { motion } from 'motion/react';
import { ListMusic, ListPlus, Pencil, Play, Shuffle, Trash2 } from 'lucide-react';
import { tapScale } from '../lib/motion';
import { Artwork } from './Artwork';
import { Reveal } from './motion/Reveal';
import { tooltipProps } from '../lib/tooltip';

function formatPlaylistDuration(ms?: number): string | null {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} hr ${mins} min`;
  }
  return `${mins} min`;
}

export interface PlaylistHeroPlaylist {
  ratingKey: string;
  title: string;
  leafCount?: number;
  duration?: number;
  artUrl?: string;
}

export interface PlaylistHeroProps {
  playlist: PlaylistHeroPlaylist;
  coverArtUrl?: string;
  trackCount: number;
  isEmpty: boolean;
  onPlay: () => void;
  onShuffle: () => void;
  onAddTracks: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function PlaylistHero({
  playlist,
  coverArtUrl,
  trackCount,
  isEmpty,
  onPlay,
  onShuffle,
  onAddTracks,
  onRename,
  onDelete,
}: PlaylistHeroProps) {
  const artUrl = coverArtUrl ?? playlist.artUrl;
  const durationLabel = formatPlaylistDuration(playlist.duration);
  const metaParts = [
    `${trackCount} ${trackCount === 1 ? 'track' : 'tracks'}`,
    durationLabel,
  ].filter(Boolean);

  return (
    <Reveal immediate>
      <div className="playlist-hero relative overflow-hidden rounded-2xl border border-white/10 bg-surface-muted/30 p-4 sm:p-6">
      {artUrl && (
        <div
          className="playlist-hero-glow"
          style={{ backgroundImage: `url(${artUrl})` }}
          aria-hidden
        />
      )}

      <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <Artwork
            src={artUrl}
            alt=""
            className="h-28 w-28 shrink-0 sm:h-36 sm:w-36 lg:h-44 lg:w-44"
            rounded="xl"
            icon={<ListMusic className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden />}
          />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Playlist</p>
            <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
              {playlist.title}
            </h2>
            {metaParts.length > 0 && (
              <p className="mt-1 text-sm text-muted">{metaParts.join(' · ')}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isEmpty && (
            <>
              <motion.button
                type="button"
                className="btn btn-primary"
                aria-label="Play"
                onClick={onPlay}
                {...tapScale}
              >
                <Play className="mr-2 h-4 w-4 translate-x-px" fill="currentColor" aria-hidden />
                Play
              </motion.button>
              <motion.button
                type="button"
                className="btn btn-secondary"
                aria-label="Shuffle"
                {...tooltipProps('Shuffle')}
                onClick={onShuffle}
                {...tapScale}
              >
                <Shuffle className="mr-2 h-4 w-4" aria-hidden />
                Shuffle
              </motion.button>
            </>
          )}
          <motion.button
            type="button"
            className={isEmpty ? 'btn btn-primary' : 'btn btn-secondary'}
            aria-label="Add tracks"
            {...tooltipProps('Add tracks')}
            onClick={onAddTracks}
            {...tapScale}
          >
            <ListPlus className="mr-2 h-4 w-4" aria-hidden />
            Add tracks
          </motion.button>
          <motion.button
            type="button"
            className="player-icon-btn h-10 w-10"
            aria-label="Rename"
            {...tooltipProps('Rename')}
            onClick={onRename}
            {...tapScale}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </motion.button>
          <motion.button
            type="button"
            className="player-icon-btn h-10 w-10 hover:text-danger"
            aria-label="Delete"
            {...tooltipProps('Delete')}
            onClick={onDelete}
            {...tapScale}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </motion.button>
        </div>
      </div>

      {isEmpty && (
        <p className="relative z-10 mt-4 text-sm text-muted">
          This playlist is empty. Add tracks from your library to start listening.
        </p>
      )}
      </div>
    </Reveal>
  );
}
