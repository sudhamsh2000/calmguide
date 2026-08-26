import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CoachFooterInput } from './CoachFooterInput';

afterEach(cleanup);

describe('CoachFooterInput', () => {
  it('renders a textarea and a send button', () => {
    render(<CoachFooterInput onSubmit={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('calls onSubmit with trimmed text when send button is clicked', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<CoachFooterInput onSubmit={handleSubmit} />);

    await user.type(screen.getByRole('textbox'), '  Is this normal?  ');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(handleSubmit).toHaveBeenCalledWith('Is this normal?');
  });

  it('clears textarea after submit', async () => {
    const user = userEvent.setup();
    render(<CoachFooterInput onSubmit={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), 'Hello');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('submits on Cmd+Enter', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<CoachFooterInput onSubmit={handleSubmit} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Some message');
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    expect(handleSubmit).toHaveBeenCalledWith('Some message');
  });

  it('submits on Ctrl+Enter', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<CoachFooterInput onSubmit={handleSubmit} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Some message');
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(handleSubmit).toHaveBeenCalledWith('Some message');
  });

  it('does not submit empty or whitespace-only text', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<CoachFooterInput onSubmit={handleSubmit} />);

    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(handleSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('disables textarea and send button when disabled prop is true', () => {
    render(<CoachFooterInput onSubmit={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('does not submit via keyboard shortcut when disabled', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();
    render(<CoachFooterInput onSubmit={handleSubmit} disabled />);

    const textarea = screen.getByRole('textbox');
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('send button is disabled when textarea is empty', () => {
    render(<CoachFooterInput onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('send button is enabled once text is entered', async () => {
    const user = userEvent.setup();
    render(<CoachFooterInput onSubmit={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), 'Hello');
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });
});
