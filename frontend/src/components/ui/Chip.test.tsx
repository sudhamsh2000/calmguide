import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from './Chip';

describe('Chip', () => {
  it('renders with the label text', () => {
    render(<Chip label="Sundowning" selected={false} onToggle={() => {}} />);
    expect(screen.getByText('Sundowning')).toBeInTheDocument();
  });

  it('shows selected state via aria-checked', () => {
    render(<Chip label="Wandering" selected={true} onToggle={() => {}} />);
    const chip = screen.getByRole('radio');
    expect(chip).toHaveAttribute('aria-checked', 'true');
  });

  it('shows unselected state via aria-checked', () => {
    render(<Chip label="Wandering" selected={false} onToggle={() => {}} />);
    const chip = screen.getByRole('radio');
    expect(chip).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup();
    const handleToggle = vi.fn();
    render(<Chip label="Music" selected={false} onToggle={handleToggle} />);

    await user.click(screen.getByText('Music'));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('accepts and applies custom className', () => {
    render(<Chip label="Test" selected={false} onToggle={() => {}} className="my-custom-class" />);
    const chip = screen.getByRole('radio');
    expect(chip.className).toContain('my-custom-class');
  });

  it('applies selected styles when selected', () => {
    render(<Chip label="Selected" selected={true} onToggle={() => {}} />);
    const chip = screen.getByRole('radio');
    expect(chip.className).toContain('bg-primary');
    // `text-onPrimary`, not a literal white: the primary pair inverts in
    // dark mode, so the label colour has to follow the fill.
    expect(chip.className).toContain('text-onPrimary');
  });

  it('applies unselected styles when not selected', () => {
    render(<Chip label="Unselected" selected={false} onToggle={() => {}} />);
    const chip = screen.getByRole('radio');
    // Use a whole-token check: the unselected style legitimately includes a
    // faint `hover:bg-primary/[0.045]` tint, which a plain substring check
    // against 'bg-primary' would false-positive on.
    const classNames = chip.className.split(/\s+/);
    expect(classNames).not.toContain('bg-primary');
  });
});
