import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CheckInScreen } from './CheckInScreen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock('@/lib/storage', () => ({
  getAccessCode: () => 'ABCD1234',
}));

vi.mock('@/lib/api', () => ({
  checkIn: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(msg: string, public status: number) { super(msg); }
  },
}));

describe('CheckInScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading and textarea', () => {
    render(<CheckInScreen />);
    expect(screen.getByText(/how are you holding up/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('disables submit button when textarea is empty', () => {
    render(<CheckInScreen />);
    expect(screen.getByRole('button', { name: /share/i })).toBeDisabled();
  });

  it('enables submit button when text is entered', () => {
    render(<CheckInScreen />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I am tired' } });
    expect(screen.getByRole('button', { name: /share/i })).not.toBeDisabled();
  });

  it('shows streamed response after submit', async () => {
    const { checkIn } = await import('@/lib/api');
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"text":"You are not alone."}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.mocked(checkIn).mockResolvedValue(stream);

    render(<CheckInScreen />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I feel tired' } });
    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByText(/you are not alone/i)).toBeInTheDocument();
    });
  });

  it('shows error message when API fails', async () => {
    const { checkIn, ApiError } = await import('@/lib/api');
    vi.mocked(checkIn).mockRejectedValue(new ApiError('fail', 500));

    render(<CheckInScreen />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I feel tired' } });
    fireEvent.click(screen.getByRole('button', { name: /share/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
