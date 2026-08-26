import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CategoryBadge } from './CategoryBadge';

describe('CategoryBadge', () => {
  it('renders behavioral category with purple styling', () => {
    render(<CategoryBadge category="behavioral" />);
    const badge = screen.getByText('Behavioral');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: '#7C4DBA', backgroundColor: '#EDE4F7' });
  });

  it('renders daily_care category with teal styling', () => {
    render(<CategoryBadge category="daily_care" />);
    const badge = screen.getByText('Daily Care');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: '#2B7A78', backgroundColor: '#D6F0EF' });
  });

  it('renders safety category with coral styling', () => {
    render(<CategoryBadge category="safety" />);
    const badge = screen.getByText('Safety');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: '#B84C36', backgroundColor: '#F8E0DA' });
  });

  it('renders communication category with blue styling', () => {
    render(<CategoryBadge category="communication" />);
    const badge = screen.getByText('Communication');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: '#3B82F6', backgroundColor: '#DBEAFE' });
  });

  it('renders self_care category with green styling', () => {
    render(<CategoryBadge category="self_care" />);
    const badge = screen.getByText('Self Care');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: '#3A7D5C', backgroundColor: '#E0F0E7' });
  });

  it('renders unknown category with neutral styling', () => {
    render(<CategoryBadge category="unknown_thing" />);
    const badge = screen.getByText('unknown thing');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: '#636E72', backgroundColor: '#F0F0F0' });
  });

  it('sets data-category attribute', () => {
    render(<CategoryBadge category="behavioral" />);
    expect(screen.getByText('Behavioral')).toHaveAttribute('data-category', 'behavioral');
  });

  it('has pill shape styling (rounded-full class)', () => {
    render(<CategoryBadge category="safety" />);
    expect(screen.getByText('Safety').className).toContain('rounded-full');
  });

  it('merges custom className', () => {
    render(<CategoryBadge category="behavioral" className="mt-2" />);
    expect(screen.getByText('Behavioral').className).toContain('mt-2');
  });
});
