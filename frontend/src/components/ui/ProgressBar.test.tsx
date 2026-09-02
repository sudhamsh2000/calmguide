import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders the correct number of segments', () => {
    render(<ProgressBar currentStep={2} totalSteps={5} />);
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByTestId(`progress-segment-${i}`)).toBeInTheDocument();
    }
  });

  it('displays the current step text', () => {
    render(<ProgressBar currentStep={3} totalSteps={5} />);
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument();
  });

  it('highlights completed segments with primary color', () => {
    render(<ProgressBar currentStep={3} totalSteps={5} />);
    // Segments 1-3 should be filled (bg-primary)
    for (let i = 1; i <= 3; i++) {
      const segment = screen.getByTestId(`progress-segment-${i}`);
      expect(segment.className).toContain('bg-primary');
    }
    // Segments 4-5 should not be filled
    for (let i = 4; i <= 5; i++) {
      const segment = screen.getByTestId(`progress-segment-${i}`);
      expect(segment.className).not.toContain('bg-primary');
    }
  });

  it('accepts a custom className', () => {
    const { container } = render(<ProgressBar currentStep={1} totalSteps={3} className="mt-4" />);
    expect(container.firstChild).toHaveClass('mt-4');
  });

  it('has a progressbar role with correct aria attributes', () => {
    render(<ProgressBar currentStep={2} totalSteps={5} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
  });
});
