import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import * as motionLib from '../../lib/motion';
import {
  RevealListItem,
  RevealStaggerGroup,
  buildViewportIndices,
  buildVisibleStaggerPositions,
  useRevealBatches,
} from './Reveal';

describe('Reveal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('RevealStaggerGroup renders children without motion when reduced motion is on', () => {
    render(
      <RevealStaggerGroup revealKey="artists:title" className="grid">
        <div data-testid="child">Artist</div>
      </RevealStaggerGroup>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('RevealStaggerGroup renders children when reduced motion is off', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    render(
      <RevealStaggerGroup revealKey="artists:title" className="grid">
        <div data-testid="child">Artist</div>
      </RevealStaggerGroup>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('RevealListItem skips motion when shouldAnimate is false', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    render(
      <RevealListItem
        index={0}
        batchStart={0}
        shouldAnimate={false}
        itemKey="1"
        listKey="tracks:title"
      >
        <div>Track</div>
      </RevealListItem>,
    );

    expect(screen.queryByTestId('reveal-list-item')).not.toBeInTheDocument();
    expect(screen.getByText('Track')).toBeInTheDocument();
  });

  it('RevealListItem renders motion wrapper when shouldAnimate is true', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    render(
      <RevealListItem
        staggerPosition={0}
        shouldAnimate
        itemKey="1"
        listKey="tracks:title"
      >
        <div>Track</div>
      </RevealListItem>,
    );

    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();
    expect(screen.getByTestId('reveal-list-item')).toHaveAttribute('data-stagger-position', '0');
  });

  it('RevealListItem applies visible-window stagger delays', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);

    render(
      <RevealListItem
        staggerPosition={2}
        shouldAnimate
        itemKey="1"
        listKey="tracks:title"
      >
        <div>Track</div>
      </RevealListItem>,
    );

    expect(screen.getByTestId('reveal-list-item')).toHaveAttribute(
      'data-stagger-delay',
      String(2 * motionLib.REVEAL_TRACK_STAGGER_STEP),
    );
  });

  it('buildVisibleStaggerPositions ranks only unseen rows in index order', () => {
    const items = [
      { ratingKey: '1' },
      { ratingKey: '2' },
      { ratingKey: '3' },
    ];
    const seen = new Set(['2']);
    const positions = buildVisibleStaggerPositions([0, 1, 2], items, seen);

    expect(positions.get('1')).toBe(0);
    expect(positions.get('3')).toBe(1);
    expect(positions.has('2')).toBe(false);
  });

  it('buildViewportIndices clamps to item count and ignores invalid ranges', () => {
    expect(buildViewportIndices(0, 2, 5)).toEqual([0, 1, 2]);
    expect(buildViewportIndices(-2, 1, 5)).toEqual([0, 1]);
    expect(buildViewportIndices(3, 10, 5)).toEqual([3, 4]);
    expect(buildViewportIndices(0, 2, 0)).toEqual([]);
  });

  it('RevealListItem renders plain content for overscan rows without marking them seen', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);
    const onRevealStart = vi.fn();

    render(
      <RevealListItem
        shouldAnimate={false}
        itemKey="overscan"
        listKey="tracks:title"
        onRevealStart={onRevealStart}
      >
        <div>Overscan track</div>
      </RevealListItem>,
    );

    expect(screen.queryByTestId('reveal-list-item')).not.toBeInTheDocument();
    expect(screen.getByText('Overscan track')).toBeVisible();
    expect(onRevealStart).not.toHaveBeenCalled();
  });

  it('RevealListItem keeps the motion wrapper until reveal completes', () => {
    vi.spyOn(motionLib, 'useAppReducedMotion').mockReturnValue(false);
    const onRevealStart = vi.fn();

    const { rerender } = render(
      <RevealListItem
        staggerPosition={0}
        shouldAnimate
        itemKey="1"
        listKey="tracks:title"
        onRevealStart={onRevealStart}
      >
        <div>Track</div>
      </RevealListItem>,
    );

    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();
    expect(onRevealStart).not.toHaveBeenCalled();

    rerender(
      <RevealListItem
        staggerPosition={0}
        shouldAnimate
        itemKey="1"
        listKey="tracks:title"
        onRevealStart={onRevealStart}
      >
        <div>Track</div>
      </RevealListItem>,
    );

    expect(screen.getByTestId('reveal-list-item')).toBeInTheDocument();
    expect(onRevealStart).not.toHaveBeenCalled();
  });

  it('useRevealBatches tracks pagination batches and resets on datasetKey change', () => {
    const { result, rerender } = renderHook(
      ({ itemCount, loading, datasetKey }) => useRevealBatches(itemCount, loading, datasetKey),
      { initialProps: { itemCount: 2, loading: false, datasetKey: 'artists:title' } },
    );

    expect(result.current).toEqual([0]);

    rerender({ itemCount: 4, loading: false, datasetKey: 'artists:title' });
    expect(result.current).toEqual([0, 2]);

    rerender({ itemCount: 4, loading: false, datasetKey: 'albums:title' });
    expect(result.current).toEqual([0]);
  });
});
