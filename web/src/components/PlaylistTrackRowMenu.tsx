import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ListPlus, MoreVertical, Trash2 } from 'lucide-react';
import type { TrackItem } from '../lib/api';
import { popoverMenu, springSoft } from '../lib/motion';
import { tooltipProps } from '../lib/tooltip';
import { usePlaylistActions } from '../context/PlaylistActionsContext';

interface MenuPosition {
  top: number;
  left: number;
}

interface PlaylistTrackRowMenuProps {
  track: TrackItem;
  onRemove: () => void;
}

export function PlaylistTrackRowMenu({ track, onRemove }: PlaylistTrackRowMenuProps) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const { openForTrack } = usePlaylistActions();

  const updatePosition = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.right,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuPanelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const menuPanel = (
    <AnimatePresence>
      {open ? (
        <motion.div
          id={menuId}
          ref={menuPanelRef}
          data-testid="playlist-track-row-menu"
          className="fixed z-[100] min-w-[11rem] -translate-x-full overflow-hidden rounded-xl border border-white/10 bg-surface-elevated p-1 shadow-xl shadow-black/30"
          style={{ top: position.top, left: position.left, transformOrigin: 'top right' }}
          role="menu"
          aria-label={`Actions for ${track.title}`}
          variants={popoverMenu}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={springSoft}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-white/5"
            onClick={() => {
              openForTrack(track);
              setOpen(false);
            }}
          >
            <ListPlus className="h-4 w-4 shrink-0" aria-hidden />
            Add to playlist
          </button>
          {track.playlistItemId && (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-white/5"
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              Remove from playlist
            </button>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="player-icon-btn h-8 w-8"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        {...tooltipProps('More actions')}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {menuPanel && createPortal(menuPanel, document.body)}
    </>
  );
}
