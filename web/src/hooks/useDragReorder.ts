import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { findMovedIndices } from '../lib/reorderPlaylistTracks';
import { reorderFromPointer } from '../lib/reorderFromPointer';

export interface DragReorderProps {
  onDragStart: () => void;
  onDragEnd: () => void;
  onPointerDrag: (clientY: number, value: string) => void;
}

export interface UseDragReorderOptions<T> {
  onRemoveItem?: (item: T) => void | Promise<void>;
  containerRef?: RefObject<Element | null>;
}

function orderSignature<T>(items: T[], getKey: (item: T) => string): string {
  return items.map(getKey).join('\0');
}

function effectiveItems<T>(
  source: T[],
  getKey: (item: T) => string,
  pendingRemovals: Set<string>,
): T[] {
  if (pendingRemovals.size === 0) return source;
  return source.filter((item) => !pendingRemovals.has(getKey(item)));
}

export function useDragReorder<T>(
  items: T[],
  getKey: (item: T) => string,
  onCommit: (dragStart: T[], fromIndex: number, toIndex: number) => void,
  options: UseDragReorderOptions<T> = {},
) {
  const { onRemoveItem, containerRef } = options;
  const [orderedItems, setOrderedItems] = useState(items);
  const isDraggingRef = useRef(false);
  const isExitingRef = useRef(false);
  const dragStartRef = useRef(items);
  const orderedItemsRef = useRef(items);
  const itemsRef = useRef(items);
  const getKeyRef = useRef(getKey);
  const pendingRemovalsRef = useRef(new Set<string>());

  getKeyRef.current = getKey;
  orderedItemsRef.current = orderedItems;
  itemsRef.current = items;

  useEffect(() => {
    for (const key of pendingRemovalsRef.current) {
      if (!items.some((item) => getKeyRef.current(item) === key)) {
        pendingRemovalsRef.current.delete(key);
      }
    }
  }, [items]);

  useEffect(() => {
    if (isDraggingRef.current || isExitingRef.current) return;

    const effective = effectiveItems(items, getKeyRef.current, pendingRemovalsRef.current);
    const localOrder = orderSignature(orderedItemsRef.current, getKeyRef.current);
    const propOrder = orderSignature(effective, getKeyRef.current);
    if (localOrder === propOrder) return;

    setOrderedItems(effective);
    dragStartRef.current = effective;
  }, [items]);

  useEffect(() => {
    if (!isExitingRef.current) return;

    const effective = effectiveItems(items, getKeyRef.current, pendingRemovalsRef.current);
    const propByKey = new Map(effective.map((item) => [getKeyRef.current(item), item]));
    setOrderedItems((current) =>
      current.map((item) => propByKey.get(getKeyRef.current(item)) ?? item),
    );
  }, [items]);

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
    dragStartRef.current = orderedItemsRef.current;
  }, []);

  const onDragEnd = useCallback(() => {
    const moved = findMovedIndices(
      dragStartRef.current,
      orderedItemsRef.current,
      getKeyRef.current,
    );
    isDraggingRef.current = false;
    if (moved) {
      const [fromIndex, toIndex] = moved;
      onCommit(dragStartRef.current, fromIndex, toIndex);
    }
  }, [onCommit]);

  const reorderByValues = useCallback((values: string[]) => {
    const byKey = new Map(orderedItemsRef.current.map((item) => [getKeyRef.current(item), item]));
    setOrderedItems(values.map((value) => byKey.get(value)!));
  }, []);

  const onPointerDrag = useCallback((clientY: number, draggedValue: string) => {
    if (!isDraggingRef.current) return;

    const container = containerRef?.current;
    if (!container) return;

    const values = orderedItemsRef.current.map((item) => getKeyRef.current(item));
    const getRowElement = (value: string) =>
      container.querySelector<HTMLElement>(`[data-reorder-value="${CSS.escape(value)}"]`);

    const next = reorderFromPointer(values, draggedValue, clientY, getRowElement);
    if (next) reorderByValues(next);
  }, [containerRef, reorderByValues]);

  const removeItem = useCallback((key: string) => {
    const snapshot = orderedItemsRef.current;
    const index = snapshot.findIndex((entry) => getKeyRef.current(entry) === key);
    if (index === -1) return;

    const item = snapshot[index];
    pendingRemovalsRef.current.add(key);
    isExitingRef.current = true;
    setOrderedItems(snapshot.filter((entry) => getKeyRef.current(entry) !== key));

    void Promise.resolve(onRemoveItem?.(item)).catch(() => {
      pendingRemovalsRef.current.delete(key);
      isExitingRef.current = false;
      setOrderedItems((current) => {
        const next = [...current];
        next.splice(index, 0, item);
        return next;
      });
    });
  }, [onRemoveItem]);

  const clearExiting = useCallback(() => {
    isExitingRef.current = false;
    const effective = effectiveItems(itemsRef.current, getKeyRef.current, pendingRemovalsRef.current);
    if (orderSignature(effective, getKeyRef.current) !== orderSignature(orderedItemsRef.current, getKeyRef.current)) {
      setOrderedItems(effective);
    }
  }, []);

  return {
    orderedItems,
    reorderValues: orderedItems.map((item) => getKey(item)),
    reorderByValues,
    removeItem,
    clearExiting,
    dragProps: { onDragStart, onDragEnd, onPointerDrag } satisfies DragReorderProps,
  };
}
