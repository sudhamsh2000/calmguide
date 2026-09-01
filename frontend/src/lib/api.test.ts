import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createProfile,
  getProfile,
  updateProfile,
  coachChat,
  getScenarios,
  interactWithScenario,
  checkIn,
  ApiError,
} from './api';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

describe('createProfile', () => {
  it('sends POST request with profile data', async () => {
    const profileData = {
      disease_stage: 'middle' as const,
      behavioral_patterns: ['sundowning'],
      calming_strategies: ['music'],
      safety_concerns: ['wandering'],
      invite_code: 'TESTCODE',
    };
    const responseData = {
      id: '1',
      access_code: 'ABC12345',
      disease_stage: 'middle',
      behavioral_patterns: ['sundowning'],
      calming_strategies: ['music'],
      safety_concerns: ['wandering'],
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(responseData));

    const result = await createProfile(profileData);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/profiles',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(profileData),
      }),
    );
    expect(result.access_code).toBe('ABC12345');
    expect(result.id).toBe('1');
  });

  it('throws ApiError on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ detail: 'Bad Request' }, 400));

    await expect(createProfile({
      disease_stage: 'early',
      behavioral_patterns: [],
      calming_strategies: [],
      safety_concerns: [],
      invite_code: 'TESTCODE',
    })).rejects.toThrow(ApiError);
  });
});

describe('getProfile', () => {
  it('sends GET request with access code', async () => {
    const profile = {
      id: '1',
      disease_stage: 'middle',
      behavioral_patterns: ['sundowning'],
      calming_strategies: ['music'],
      safety_concerns: ['wandering'],
    };

    mockFetch.mockResolvedValueOnce(mockJsonResponse(profile));

    const result = await getProfile('ABC12345');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/profiles/ABC12345',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(result.id).toBe('1');
    expect(result.disease_stage).toBe('middle');
  });

  it('encodes special characters in access code', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      id: '1', disease_stage: 'early', behavioral_patterns: [],
      calming_strategies: [], safety_concerns: [],
    }));

    await getProfile('A+B/C');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/profiles/A%2BB%2FC',
      expect.anything(),
    );
  });
});

describe('updateProfile', () => {
  it('sends PUT request with full profile data', async () => {
    const updateData = {
      disease_stage: 'late' as const,
      behavioral_patterns: ['wandering'],
      calming_strategies: ['music'],
      safety_concerns: ['fall risk'],
    };
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      id: '1', disease_stage: 'late',
      behavioral_patterns: ['wandering'], calming_strategies: ['music'], safety_concerns: ['fall risk'],
    }));

    const result = await updateProfile('ABC12345', updateData);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/profiles/ABC12345',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(updateData),
      }),
    );
    expect(result.disease_stage).toBe('late');
  });
});

describe('coachChat', () => {
  it('sends POST with chat params and returns stream body', async () => {
    const mockBody = new ReadableStream();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: mockBody,
    });

    const stream = await coachChat('ABC12345', 'Mom', 'She is agitated');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/coach/chat',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(stream).toBe(mockBody);
  });

  it('throws ApiError when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Internal error' }),
      text: () => Promise.resolve('Internal error'),
    });

    await expect(coachChat('ABC12345', 'Mom', 'Help')).rejects.toThrow(ApiError);
  });

  it('throws ApiError when response has no body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: null,
    });

    await expect(coachChat('ABC12345', 'Mom', 'Help')).rejects.toThrow('No response body');
  });

  it('includes session_id when provided', async () => {
    const mockBody = new ReadableStream();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: mockBody,
    });

    await coachChat('ABC12345', 'Mom', 'Help', 'session-1');

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(callBody.session_id).toBe('session-1');
  });
});

describe('getScenarios', () => {
  it('fetches scenario list', async () => {
    const scenarios = [
      { id: '1', title: 'Sundowning', description: 'Evening agitation', disease_stage: 'middle', category: 'behavioral' },
    ];
    mockFetch.mockResolvedValueOnce(mockJsonResponse(scenarios));

    const result = await getScenarios();

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/learn/scenarios',
      expect.anything(),
    );
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Sundowning');
  });

  it('passes disease_stage and category as query params', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse([]));

    await getScenarios('middle', 'behavioral');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/learn/scenarios?disease_stage=middle&category=behavioral',
      expect.anything(),
    );
  });
});

describe('interactWithScenario', () => {
  it('sends POST with scenario interaction data', async () => {
    const interactData = {
      scenario_id: 'sundowning-evening',
      disease_stage: 'middle',
      message: 'I would play calming music',
    };
    const responseData = { response: 'Good approach! Music can be very effective...' };
    mockFetch.mockResolvedValueOnce(mockJsonResponse(responseData));

    const result = await interactWithScenario(interactData);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/learn/interact',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(interactData),
      }),
    );
    expect(result.response).toBe('Good approach! Music can be very effective...');
  });
});

describe('ApiError', () => {
  it('has correct name, message, status, and body', () => {
    const error = new ApiError('Not found', 404, { detail: 'missing' });
    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('Not found');
    expect(error.status).toBe(404);
    expect(error.body).toEqual({ detail: 'missing' });
  });
});

describe('checkIn', () => {
  it('calls POST /api/checkin and returns a ReadableStream', async () => {
    const mockStream = new ReadableStream();
    mockFetch.mockResolvedValueOnce({ ok: true, body: mockStream });

    const result = await checkIn('ABCD1234', 'I feel tired');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/checkin'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ access_code: 'ABCD1234', message: 'I feel tired' }),
      }),
    );
    expect(result).toBe(mockStream);
  });

  it('throws ApiError when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Profile not found' }),
    });

    await expect(checkIn('BADCODE1', 'hello')).rejects.toThrow(ApiError);
  });
});
