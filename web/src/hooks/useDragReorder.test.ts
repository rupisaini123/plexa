import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDragReorder } from './useDragReorder';
import { reorderArray } from '../lib/reorderPlaylistTracks';

const items = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
];

describe('useDragReorder', () => {
  it('does not commit when drag ends without changing order', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDragReorder(items, (item) => item.id, onCommit),
    );

    act(() => {
      result.current.dragProps.onDragStart();
      result.current.dragProps.onDragEnd();
    });

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits once on drag end when order changed during preview', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDragReorder(items, (item) => item.id, onCommit),
    );

    const preview = reorderArray(items, 0, 2);

    act(() => {
      result.current.dragProps.onDragStart();
      result.current.reorderByValues(preview.map((item) => item.id));
    });

    act(() => {
      result.current.dragProps.onDragEnd();
    });

    expect(onCommit).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledWith(items, 0, 2);
  });

  it('does not sync props into orderedItems while dragging', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ nextItems }) => useDragReorder(nextItems, (item) => item.id, onCommit),
      { initialProps: { nextItems: items } },
    );

    act(() => {
      result.current.dragProps.onDragStart();
      result.current.reorderByValues(['b', 'a', 'c']);
    });

    rerender({ nextItems: [{ id: 'x', label: 'X' }] });

    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not clobber local order when props lag behind a completed drag', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ nextItems }) => useDragReorder(nextItems, (item) => item.id, onCommit),
      { initialProps: { nextItems: items } },
    );

    act(() => {
      result.current.dragProps.onDragStart();
      result.current.reorderByValues(['b', 'a', 'c']);
    });

    act(() => {
      result.current.dragProps.onDragEnd();
    });

    rerender({ nextItems: items });

    expect(onCommit).toHaveBeenCalledOnce();
    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('syncs orderedItems from props after drag ends when order changes externally', () => {
    const onCommit = vi.fn();
    const updated = [
      { id: 'x', label: 'X' },
      { id: 'y', label: 'Y' },
    ];
    const { result, rerender } = renderHook(
      ({ nextItems }) => useDragReorder(nextItems, (item) => item.id, onCommit),
      { initialProps: { nextItems: items } },
    );

    act(() => {
      result.current.dragProps.onDragStart();
      result.current.reorderByValues(['c', 'b', 'a']);
      result.current.dragProps.onDragEnd();
    });

    rerender({ nextItems: updated });

    expect(result.current.orderedItems).toEqual(updated);
  });

  it('removeItem filters local state and calls onRemoveItem', () => {
    const onCommit = vi.fn();
    const onRemoveItem = vi.fn();
    const { result } = renderHook(() =>
      useDragReorder(items, (item) => item.id, onCommit, { onRemoveItem }),
    );

    act(() => {
      result.current.removeItem('b');
    });

    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['a', 'c']);
    expect(onRemoveItem).toHaveBeenCalledWith({ id: 'b', label: 'B' });
  });

  it('refreshes item metadata from props during exit animation', () => {
    const onCommit = vi.fn();
    const onRemoveItem = vi.fn();
    const { result, rerender } = renderHook(
      ({ nextItems }) => useDragReorder(nextItems, (item) => item.id, onCommit, { onRemoveItem }),
      { initialProps: { nextItems: items } },
    );

    act(() => {
      result.current.removeItem('b');
    });

    const updatedAfterRemove = [
      { id: 'a', label: 'A-updated' },
      { id: 'c', label: 'C-updated' },
    ];
    rerender({ nextItems: updatedAfterRemove });

    expect(result.current.orderedItems).toEqual(updatedAfterRemove);
  });

  it('clearExiting syncs from latest props via itemsRef', () => {
    const onCommit = vi.fn();
    const onRemoveItem = vi.fn();
    const { result, rerender } = renderHook(
      ({ nextItems }) => useDragReorder(nextItems, (item) => item.id, onCommit, { onRemoveItem }),
      { initialProps: { nextItems: items } },
    );

    act(() => {
      result.current.removeItem('b');
    });

    rerender({
      nextItems: [
        { id: 'a', label: 'A' },
        { id: 'c', label: 'C' },
      ],
    });

    rerender({
      nextItems: [
        { id: 'a', label: 'A' },
        { id: 'c', label: 'C' },
        { id: 'd', label: 'D' },
      ],
    });

    act(() => {
      result.current.clearExiting();
    });

    expect(result.current.orderedItems).toEqual([
      { id: 'a', label: 'A' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ]);
  });

  it('ignores duplicate removeItem calls for the same key during exit', () => {
    const onCommit = vi.fn();
    const onRemoveItem = vi.fn();
    const { result } = renderHook(() =>
      useDragReorder(items, (item) => item.id, onCommit, { onRemoveItem }),
    );

    act(() => {
      result.current.removeItem('b');
    });

    act(() => {
      result.current.removeItem('b');
    });

    expect(onRemoveItem).toHaveBeenCalledOnce();
    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('does not sync props into orderedItems while exit animation is running', () => {
    const onCommit = vi.fn();
    const onRemoveItem = vi.fn();
    const { result, rerender } = renderHook(
      ({ nextItems }) => useDragReorder(nextItems, (item) => item.id, onCommit, { onRemoveItem }),
      { initialProps: { nextItems: items } },
    );

    act(() => {
      result.current.removeItem('b');
    });

    rerender({ nextItems: items.filter((item) => item.id !== 'b') });

    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['a', 'c']);

    act(() => {
      result.current.clearExiting();
    });

    rerender({ nextItems: items.filter((item) => item.id !== 'b') });

    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('does not re-insert removed item on clearExiting while props are still stale', () => {
    const onCommit = vi.fn();
    const onRemoveItem = vi.fn();
    const { result } = renderHook(() =>
      useDragReorder(items, (item) => item.id, onCommit, { onRemoveItem }),
    );

    act(() => {
      result.current.removeItem('b');
    });

    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['a', 'c']);

    act(() => {
      result.current.clearExiting();
    });

    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('restores item when onRemoveItem rejects', async () => {
    const onRemoveItem = vi.fn().mockRejectedValue(new Error('remove failed'));
    const { result } = renderHook(() =>
      useDragReorder(items, (item) => item.id, vi.fn(), { onRemoveItem }),
    );

    act(() => {
      result.current.removeItem('b');
    });

    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['a', 'c']);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(onRemoveItem).toHaveBeenCalledWith({ id: 'b', label: 'B' });
  });

  it('reorders from pointer position using live row rects during drag', () => {
    const container = document.createElement('div');
    const rowA = document.createElement('div');
    rowA.dataset.reorderValue = 'a';
    rowA.getBoundingClientRect = () => ({
      top: 0,
      height: 48,
      bottom: 48,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const rowB = document.createElement('div');
    rowB.dataset.reorderValue = 'b';
    rowB.getBoundingClientRect = () => ({
      top: 48,
      height: 48,
      bottom: 96,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 48,
      toJSON: () => ({}),
    });
    const rowC = document.createElement('div');
    rowC.dataset.reorderValue = 'c';
    rowC.getBoundingClientRect = () => ({
      top: 96,
      height: 48,
      bottom: 144,
      left: 0,
      right: 100,
      width: 100,
      x: 0,
      y: 96,
      toJSON: () => ({}),
    });
    container.append(rowA, rowB, rowC);

    const containerRef = { current: container };
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useDragReorder(items, (item) => item.id, onCommit, { containerRef }),
    );

    act(() => {
      result.current.dragProps.onDragStart();
      result.current.dragProps.onPointerDrag(20, 'c');
    });

    expect(result.current.orderedItems.map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });
});
