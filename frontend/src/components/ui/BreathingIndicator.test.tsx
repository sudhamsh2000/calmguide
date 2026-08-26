import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { BreathingIndicator } from './BreathingIndicator';

afterEach(cleanup);

describe('BreathingIndicator', () => {
  it('renders with default message', () => {
    render(<BreathingIndicator />);
    expect(screen.getByText('Finding guidance for you...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<BreathingIndicator message="Processing your question..." />);
    expect(screen.getByText('Processing your question...')).toBeInTheDocument();
  });

  it('has animation class on the circle element', () => {
    const { container } = render(<BreathingIndicator />);
    const animatedEl = container.querySelector('[class*="animate-"]');
    expect(animatedEl).toBeInTheDocument();
  });

  it('accepts className prop', () => {
    const { container } = render(<BreathingIndicator className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });

  it('has accessible status role', () => {
    render(<BreathingIndicator />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
