import { LibraryDetailPane } from './LibraryDetailPane';

interface DetailPanelProps {
  type: 'artist' | 'album';
  id: string;
  onClose: () => void;
}

/** Sheet-style detail panel used by legacy call sites. */
export function DetailPanel({ type, id, onClose }: DetailPanelProps) {
  return (
    <LibraryDetailPane
      selection={{ type, key: id }}
      mode="sheet"
      onClose={onClose}
      onOpenAlbum={() => undefined}
    />
  );
}
