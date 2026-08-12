import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonStack, TrackRowSkeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders SkeletonStack with status role and sr-only label', () => {
    render(<SkeletonStack count={3} label="Loading items" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading items')).toHaveClass('sr-only');
    expect(screen.getByRole('status').querySelectorAll('.skeleton').length).toBe(3);
  });

  it('renders custom SkeletonStack children', () => {
    render(
      <SkeletonStack count={2} label="Loading tracks">
        {(index) => <TrackRowSkeleton key={index} index={index + 1} />}
      </SkeletonStack>,
    );
    expect(screen.getByRole('status').querySelectorAll('.skeleton').length).toBeGreaterThan(2);
  });
});
