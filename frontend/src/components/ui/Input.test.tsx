import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Input } from './Input';

describe('Input', () => {
  it('renders with a visible label', () => {
    render(<Input label="Patient Name" />);
    expect(screen.getByLabelText('Patient Name')).toBeInTheDocument();
  });

  it('associates label with input via htmlFor', () => {
    render(<Input label="Access Code" />);
    const input = screen.getByLabelText('Access Code');
    expect(input.tagName).toBe('INPUT');
  });

  it('accepts user input', async () => {
    const user = userEvent.setup();
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');

    await user.type(input, 'Margaret');
    expect(input).toHaveValue('Margaret');
  });

  it('displays error message when error prop is provided', () => {
    render(<Input label="Code" error="Code is required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Code is required');
  });

  it('sets aria-invalid when error is present', () => {
    render(<Input label="Code" error="Required" />);
    const input = screen.getByLabelText('Code');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('sets aria-describedby pointing to error message', () => {
    render(<Input label="Code" error="Required" />);
    const input = screen.getByLabelText('Code');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const errorEl = screen.getByRole('alert');
    expect(errorEl.id).toBe(describedBy);
  });

  it('does not set aria-invalid when no error', () => {
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('applies error styling when error is present', () => {
    render(<Input label="Name" error="Error" />);
    const input = screen.getByLabelText('Name');
    // Error border comes from the `field-shell-error` utility class
    // (see globals.css), not a literal Tailwind `border-error` class.
    expect(input.className).toContain('field-shell-error');
  });

  it('forwards placeholder attribute', () => {
    render(<Input label="Name" placeholder="Enter name" />);
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
  });

  it('forwards onChange handler', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input label="Name" onChange={handleChange} />);

    await user.type(screen.getByLabelText('Name'), 'A');
    expect(handleChange).toHaveBeenCalled();
  });

  it('uses provided id instead of generated one', () => {
    render(<Input label="Name" id="custom-id" />);
    const input = screen.getByLabelText('Name');
    expect(input.id).toBe('custom-id');
  });

  it('merges custom className on wrapper', () => {
    const { container } = render(<Input label="Name" className="mt-4" />);
    expect(container.firstElementChild?.className).toContain('mt-4');
  });
});
