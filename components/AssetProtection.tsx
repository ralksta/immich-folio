'use client';

import { useEffect } from 'react';

interface Props {
  disableRightClick?: boolean;
  disableImageDrag?: boolean;
}

export default function AssetProtection({ disableRightClick, disableImageDrag }: Props) {
  useEffect(() => {
    if (!disableRightClick && !disableImageDrag) return;

    function handleContextMenu(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (disableRightClick && (target.tagName === 'IMG' || target.closest('img') || target.classList.contains('photo-tile') || target.classList.contains('lightbox-img'))) {
        e.preventDefault();
      }
    }

    function handleDragStart(e: DragEvent) {
      const target = e.target as HTMLElement;
      if (disableImageDrag && (target.tagName === 'IMG' || target.closest('img'))) {
        e.preventDefault();
      }
    }

    if (disableRightClick) {
      document.addEventListener('contextmenu', handleContextMenu);
    }
    if (disableImageDrag) {
      document.addEventListener('dragstart', handleDragStart);
    }

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, [disableRightClick, disableImageDrag]);

  return null;
}
