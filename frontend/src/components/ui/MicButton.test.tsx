import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MicButton } from "./MicButton";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

function createMockRecognition() {
  return vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    continuous: false,
    interimResults: false,
    lang: "",
    onresult: null,
    onerror: null,
    onend: null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MicButton", () => {
  it("renders when SpeechRecognition is available", () => {
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: createMockRecognition(),
      writable: true,
      configurable: true,
    });
    render(<MicButton onTranscript={() => {}} />);
    expect(screen.getByRole("button", { name: /voice input/i })).toBeInTheDocument();
  });

  it("does not render when SpeechRecognition is unavailable", () => {
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const { container } = render(<MicButton onTranscript={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});
