/**
 * Regression test for XCON-1: the backend CoachRequest/CheckInRequest require a
 * non-empty patient_name. These tests assert that the streaming request body
 * always carries patient_name, for both the access_code and profile_id branches.
 */

// api.ts reads Constants.expoConfig?.hostUri at import time — give it a host so
// resolveApiBase() produces a deterministic dev URL.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: '127.0.0.1:8081' } },
}));

// Avoid pulling the real (heavy) i18n locale loader into this unit test.
jest.mock('@/lib/i18n', () => ({
  i18n: { language: 'en' },
}));

// The facility (profile_id) branch resolves a staff JWT from SecureStore before
// opening the stream. Mock it so the request is actually sent in tests.
jest.mock('@/lib/facility-storage', () => ({
  getToken: jest.fn(() => Promise.resolve('test-jwt-token')),
}));

import { streamCheckIn, streamCoachChat } from '../api';

interface CapturedRequest {
  url: string;
  body: Record<string, unknown>;
}

let sentRequests: CapturedRequest[];

class MockXHR {
  static lastUrl = '';
  static lastHeaders: Record<string, string> = {};
  // event handlers assigned by streamSSE — unused here, we resolve synchronously
  onprogress: (() => void) | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  onreadystatechange: (() => void) | null = null;
  timeout = 0;
  status = 200;
  responseText = '';

  open(_method: string, url: string) {
    MockXHR.lastUrl = url;
  }
  setRequestHeader(name: string, value: string) {
    MockXHR.lastHeaders[name] = value;
  }
  abort() {}
  send(body: string) {
    sentRequests.push({ url: MockXHR.lastUrl, body: JSON.parse(body) });
  }
}

beforeEach(() => {
  sentRequests = [];
  MockXHR.lastHeaders = {};
  // @ts-expect-error — replacing the global with a minimal mock
  global.XMLHttpRequest = MockXHR;
});

describe('streamCoachChat request body (XCON-1)', () => {
  it('includes a non-empty patient_name on the access_code branch', () => {
    streamCoachChat(
      { access_code: 'ABCD1234', patient_name: 'Mom', message: 'She is upset' },
      () => {},
      () => {},
      () => {},
    );

    expect(sentRequests).toHaveLength(1);
    const { url, body } = sentRequests[0];
    expect(url).toContain('/api/coach/chat');
    expect(body.access_code).toBe('ABCD1234');
    expect(body.patient_name).toBe('Mom');
    expect(typeof body.patient_name).toBe('string');
    expect((body.patient_name as string).length).toBeGreaterThan(0);
  });

  it('includes patient_name and the staff JWT on the facility profile_id branch', async () => {
    streamCoachChat(
      { profile_id: 'profile-uuid', patient_name: 'Resident', message: 'Wandering' },
      () => {},
      () => {},
      () => {},
    );
    // The token is resolved asynchronously before the request is sent.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sentRequests).toHaveLength(1);
    const { body } = sentRequests[0];
    expect(body.profile_id).toBe('profile-uuid');
    expect(body.patient_name).toBe('Resident');
    // B2B path must attach the staff JWT, or the backend rejects it (401).
    expect(MockXHR.lastHeaders.Authorization).toBe('Bearer test-jwt-token');
  });
});

describe('streamCheckIn request body (XCON-1)', () => {
  it('includes a non-empty patient_name', () => {
    streamCheckIn(
      { access_code: 'ABCD1234', patient_name: 'Dad', message: 'Hard morning' },
      () => {},
      () => {},
      () => {},
    );

    const { url, body } = sentRequests[0];
    expect(url).toContain('/api/checkin');
    expect(body.patient_name).toBe('Dad');
    expect((body.patient_name as string).length).toBeGreaterThan(0);
  });
});
