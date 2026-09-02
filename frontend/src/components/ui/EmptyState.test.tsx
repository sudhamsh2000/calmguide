import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the message', () => {
    render(<EmptyState message="No conversations yet." />);
    expect(screen.getByText('No conversations yet.')).toBeInTheDocument();
  });

  it('renders the default icon when no custom icon is provided', () => {
    const { container } = render(<EmptyState message="Empty" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a custom icon when provided', () => {
    render(<EmptyState message="Empty" icon={<span data-testid="custom-icon">Icon</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const handleAction = vi.fn();
    render(<EmptyState message="No items" actionLabel="Add Item" onAction={handleAction} />);
    expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
  });

  it('does not render action button when actionLabel is missing', () => {
    render(<EmptyState message="No items" onAction={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render action button when onAction is missing', () => {
    render(<EmptyState message="No items" actionLabel="Add Item" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onAction when action button is clicked', async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();
    render(<EmptyState message="No items" actionLabel="Create New" onAction={handleAction} />);

    await user.click(screen.getByRole('button', { name: 'Create New' }));
    expect(handleAction).toHaveBeenCalledOnce();
  });

  it('merges custom className', () => {
    const { container } = render(<EmptyState message="Empty" className="my-custom" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('my-custom');
  });
});
