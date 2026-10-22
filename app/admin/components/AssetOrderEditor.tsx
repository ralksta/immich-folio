'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useScrollLock } from './useScrollLock';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useAdminDictionary } from './AdminI18n';
import { useAdminFetch } from './useAdminFetch';
import AdminLoadState from './AdminLoadState';

interface AssetInfo {
  id: string;
  type: string;
  originalFileName: string;
  fileCreatedAt: string;
}

interface Props {
  albumId: string;
  albumName: string;
  /** Currently pinned asset IDs, in display order. */
  assetOrder: string[];
  onSave: (assetOrder: string[]) => void;
  onClose: () => void;
}

function SortableAssetTile({
  asset,
  index,
  onUnpin,
}: {
  asset: AssetInfo;
  index: number;
  onUnpin: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: asset.id,
  });
  const t = useAdminDictionary().pickers.orderEditor;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="order-tile order-tile-pinned"
      title={asset.originalFileName}
      {...attributes}
      {...listeners}
    >
      <img src={`/api/admin/thumbnail/${asset.id}`} alt={asset.originalFileName} loading="lazy" />
      <span className="order-tile-index">{index + 1}</span>
      <button
        type="button"
        className="order-tile-action"
        title={t.unpinTitle}
        aria-label={t.unpin(asset.originalFileName)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onUnpin();
        }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Editor for `sort: manual`.
 *
 * `manual` is a pinned *prefix*: the saved list holds only the photos placed by
 * hand, and everything else follows in the album's Immich order. The two zones
 * exist to make that visible rather than something the owner has to be told.
 */
export default function AssetOrderEditor({
  albumId,
  albumName,
  assetOrder,
  onSave,
  onClose,
}: Props) {
  useScrollLock(true);
  const cardRef = useModalDialog(onClose);
  const dict = useAdminDictionary();
  const t = dict.pickers.orderEditor;
  // types=all: the public grid renders videos too, so a video has to be
  // pinnable — otherwise it could only ever land in the unpinned tail.
  const load = useAdminFetch<{ assets: AssetInfo[] }>(
    `/api/admin/albums/${albumId}/assets?types=all`,
  );
  const { loading, error } = load;
  const assets = useMemo(() => load.data?.assets ?? [], [load.data]);
  /** The author's order once they have changed it; until then, the stored one. */
  const [edited, setPinnedIds] = useState<string[] | null>(null);
  // Reconcile against the *live* album rather than rendering the stored
  // list: IDs removed from the album in Immich drop out, and new photos
  // appear in the unpinned zone instead of being invisible.
  const pinnedIds = useMemo(() => {
    if (edited) return edited;
    const live = new Set(assets.map((a) => a.id));
    return assetOrder.filter((id) => live.has(id));
  }, [edited, assets, assetOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const pinned = useMemo(
    () => pinnedIds.map((id) => byId.get(id)).filter((a): a is AssetInfo => Boolean(a)),
    [pinnedIds, byId],
  );
  const unpinned = useMemo(() => {
    const set = new Set(pinnedIds);
    return assets.filter((a) => !set.has(a.id));
  }, [assets, pinnedIds]);

  // Drift is reported, never acted on by itself. A pruned list is written only
  // when the user saves — auto-saving it would let one failed Immich request
  // quietly destroy a hand-curated order.
  const dropped = useMemo(() => {
    if (loading || error) return 0;
    const live = new Set(assets.map((a) => a.id));
    return assetOrder.filter((id) => !live.has(id)).length;
  }, [assetOrder, assets, loading, error]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = pinnedIds.indexOf(String(active.id));
    const to = pinnedIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    setPinnedIds(arrayMove(pinnedIds, from, to));
  }

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div
        className="asset-picker-modal"
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-editor-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-header">
          <h3 id="order-editor-title">{t.title(albumName)}</h3>
          <button
            type="button"
            className="admin-btn-icon"
            onClick={onClose}
            aria-label={dict.common.close}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="asset-picker-loading">
            <div className="admin-spinner" />
          </div>
        ) : error ? (
          <AdminLoadState loading={false} error={error} onRetry={load.reload} />
        ) : (
          <div className="order-editor-body">
            {dropped > 0 && <p className="order-editor-notice">{t.dropped(dropped)}</p>}

            <div className="order-editor-section">
              <div className="order-editor-section-head">
                <h4>{t.pinned(pinned.length)}</h4>
                {pinned.length > 0 && (
                  <button className="admin-btn admin-btn-sm" onClick={() => setPinnedIds([])}>
                    {t.unpinAll}
                  </button>
                )}
              </div>
              {pinned.length === 0 ? (
                <p className="empty-hint">{t.nothingPinned}</p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={pinnedIds} strategy={rectSortingStrategy}>
                    <div className="order-editor-grid">
                      {pinned.map((asset, i) => (
                        <SortableAssetTile
                          key={asset.id}
                          asset={asset}
                          index={i}
                          onUnpin={() => setPinnedIds(pinnedIds.filter((id) => id !== asset.id))}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="order-editor-section">
              <div className="order-editor-section-head">
                <h4>{t.following(unpinned.length)}</h4>
                {unpinned.length > 0 && (
                  <button
                    className="admin-btn admin-btn-sm"
                    onClick={() => setPinnedIds([...pinnedIds, ...unpinned.map((a) => a.id)])}
                  >
                    {t.pinAll}
                  </button>
                )}
              </div>
              <p className="empty-hint">{t.followingHint}</p>
              <div className="order-editor-grid">
                {unpinned.map((asset) => (
                  <button
                    type="button"
                    key={asset.id}
                    className="order-tile order-tile-unpinned"
                    title={asset.originalFileName}
                    aria-label={t.pin(asset.originalFileName)}
                    onClick={() => setPinnedIds([...pinnedIds, asset.id])}
                  >
                    <img src={`/api/admin/thumbnail/${asset.id}`} alt="" loading="lazy" />
                    <span className="order-tile-action" aria-hidden="true">
                      +
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="order-editor-footer">
          <button className="admin-btn admin-btn-ghost" onClick={onClose}>
            {dict.common.cancel}
          </button>
          <button
            className="admin-btn admin-btn-primary"
            // Saving after a failed load would persist an empty or truncated
            // order over the real one.
            disabled={loading || !!error}
            onClick={() => onSave(pinnedIds)}
          >
            {t.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
