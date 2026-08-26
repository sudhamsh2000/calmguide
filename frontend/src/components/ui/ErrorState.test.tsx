import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders the error message', () => {
    render(<ErrorState message="Something went wrong. Please try again." />);
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });

  it('has role="alert" for accessibility', () => {
    render(<ErrorState message="Error occurred" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const handleRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={handleRetry} />);
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState message="Error" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={handleRetry} />);

    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(handleRetry).toHaveBeenCalledOnce();
  });

  it('renders the warning icon', () => {
    const { container } = render(<ErrorState message="Error" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    render(<ErrorState message="Error" className="mt-8" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('mt-8');
  });

  it('uses soft coral error background', () => {
    render(<ErrorState message="Error" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-error/8');
  });
});
