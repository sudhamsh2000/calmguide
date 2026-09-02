import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CoachInput } from './CoachInput';

afterEach(cleanup);

describe('CoachInput', () => {
  it('renders textarea and submit button', () => {
    render(<CoachInput onSubmit={vi.fn()} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get guidance|send/i })).toBeInTheDocument();
  });

  it('calls onSubmit with text content', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<CoachInput onSubmit={handleSubmit} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Mom is very agitated');
    await user.click(screen.getByRole('button', { name: /get guidance|send/i }));

    expect(handleSubmit).toHaveBeenCalledWith('Mom is very agitated');
  });

  it('clears input after submit', async () => {
    const user = userEvent.setup();
    render(<CoachInput onSubmit={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Some text');
    await user.click(screen.getByRole('button', { name: /get guidance|send/i }));

    expect(textarea).toHaveValue('');
  });

  it('disables textarea and button when disabled prop is true', () => {
    render(<CoachInput onSubmit={vi.fn()} disabled />);

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /get guidance|send/i })).toBeDisabled();
  });

  it('shows character count', async () => {
    const user = userEvent.setup();
    render(<CoachInput onSubmit={vi.fn()} />);

    expect(screen.getByText(/0\s*\/\s*500/)).toBeInTheDocument();

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello');

    expect(screen.getByText(/5\s*\/\s*500/)).toBeInTheDocument();
  });

  it('does not submit empty text', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<CoachInput onSubmit={handleSubmit} />);

    await user.click(screen.getByRole('button', { name: /get guidance|send/i }));

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('does not submit whitespace-only text', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<CoachInput onSubmit={handleSubmit} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, '   ');
    await user.click(screen.getByRole('button', { name: /get guidance|send/i }));

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('accepts className prop', () => {
    const { container } = render(<CoachInput onSubmit={vi.fn()} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('uses custom placeholder', () => {
    render(<CoachInput onSubmit={vi.fn()} placeholder="Ask a follow-up..." />);
    expect(screen.getByPlaceholderText('Ask a follow-up...')).toBeInTheDocument();
  });

  it('uses custom button label', () => {
    render(<CoachInput onSubmit={vi.fn()} buttonLabel="Send" />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });
});
