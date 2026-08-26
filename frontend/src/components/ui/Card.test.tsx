import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies default variant (border)', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstElementChild;
    expect(card?.className).toContain('border');
  });

  it('applies elevated variant (shadow)', () => {
    const { container } = render(<Card variant="elevated">Content</Card>);
    const card = container.firstElementChild;
    expect(card?.className).toContain('shadow-md');
  });

  it('applies interactive variant (hover shadow + cursor)', () => {
    const { container } = render(<Card variant="interactive">Content</Card>);
    const card = container.firstElementChild;
    expect(card?.className).toContain('hover:shadow-lg');
    expect(card?.className).toContain('cursor-pointer');
  });

  it('applies small padding', () => {
    const { container } = render(<Card padding="sm">Content</Card>);
    const card = container.firstElementChild;
    expect(card?.className).toContain('p-3');
  });

  it('applies medium padding by default', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstElementChild;
    expect(card?.className).toContain('p-4');
  });

  it('applies large padding', () => {
    const { container } = render(<Card padding="lg">Content</Card>);
    const card = container.firstElementChild;
    expect(card?.className).toContain('p-6');
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="mt-8">Content</Card>);
    const card = container.firstElementChild;
    expect(card?.className).toContain('mt-8');
  });

  it('has rounded corners', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstElementChild;
    expect(card?.className).toContain('rounded-2xl');
  });

  it('forwards additional HTML attributes', () => {
    render(<Card data-testid="my-card" role="article">Content</Card>);
    expect(screen.getByTestId('my-card')).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
  });
});
