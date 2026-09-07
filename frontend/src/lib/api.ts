import { getPreferredLanguage } from './storage';
import { getFacilityToken } from './facility-storage';
import { resolveSupportedLocale } from './locale';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function getActiveLocale(): string | null {
  const preferredLanguage = resolveSupportedLocale(getPreferredLanguage());
  if (preferredLanguage) return preferredLanguage;

  if (typeof document !== 'undefined') {
    const documentLocale = resolveSupportedLocale(document.documentElement.lang);
    if (documentLocale) return documentLocale;
  }

  if (typeof window !== 'undefined') {
    const pathLocale = window.location.pathname.split('/').filter(Boolean)[0];
    const resolvedPathLocale = resolveSupportedLocale(pathLocale);
    if (resolvedPathLocale) return resolvedPathLocale;
  }

  return null;
}

export interface ProfileResponse {
  id: string;
  disease_stage: string;
  behavioral_patterns: string[];
  calming_strategies: string[];
  safety_concerns: string[];
}

export interface CreateProfileData {
  disease_stage: 'early' | 'middle' | 'late';
  behavioral_patterns: string[];
  calming_strategies: string[];
  safety_concerns: string[];
  /** Pre-generated invite code required while the app is in private
   * testing (Settings.INVITE_CODE_REQUIRED on the backend). Ignored by the
   * server once that gate is turned off. */
  invite_code: string;
}

export interface UpdateProfileData {
  disease_stage: 'early' | 'middle' | 'late';
  behavioral_patterns: string[];
  calming_strategies: string[];
  safety_concerns: string[];
}

export interface CreateProfileResponse extends ProfileResponse {
  access_code: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  disease_stage: string;
  category: string;
}

export interface LearnInteractRequest {
  scenario_id: string;
  disease_stage: string;
  message: string;
}

export interface LearnInteractResponse {
  response: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Default timeout for API calls. A hung connection (bad wifi, dead backend)
 * should fail with a clear "check your connection" message rather than
 * spinning indefinitely — mirrors mobile/src/lib/api.ts's fetchWithTimeout. */
const DEFAULT_FETCH_TIMEOUT_MS = 20000;

export class RequestTimeoutError extends Error {
  constructor(message = 'The request timed out. Check your connection and try again.') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * fetch() with an AbortController-based timeout. Aborts after `timeoutMs`
 * and throws RequestTimeoutError. For streaming callers (coachChat,
 * checkIn) this only bounds time-to-first-response: the browser's fetch()
 * promise resolves once response headers arrive, before the body is read,
 * so a slow-but-connected stream isn't cut off mid-response.
 */
async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new RequestTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const resolvedLanguage = getActiveLocale();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(resolvedLanguage ? { 'X-App-Locale': resolvedLanguage } : {}),
    ...options.headers,
  };

  const response = await fetchWithTimeout(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new ApiError(
      `API request failed: ${response.status} ${response.statusText}`,
      response.status,
      body,
    );
  }

  return response.json() as Promise<T>;
}

export async function createProfile(data: CreateProfileData): Promise<CreateProfileResponse> {
  return request<CreateProfileResponse>('/api/profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface ValidateInviteCodeResponse {
  valid: boolean;
}

/** Checks an invite code without consuming it or creating a profile — used
 * by the signup wizard's invite-code step for immediate feedback. The
 * server re-validates independently in createProfile(), so this is purely
 * a UX convenience, not the actual enforcement point. */
export async function validateInviteCode(code: string): Promise<ValidateInviteCodeResponse> {
  return request<ValidateInviteCodeResponse>('/api/invite-codes/validate', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function getProfile(accessCode: string): Promise<ProfileResponse> {
  return request<ProfileResponse>(`/api/profiles/${encodeURIComponent(accessCode)}`);
}

export async function updateProfile(
  accessCode: string,
  data: UpdateProfileData,
): Promise<ProfileResponse> {
  return request<ProfileResponse>(`/api/profiles/${encodeURIComponent(accessCode)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function coachChat(
  accessCode: string | null,
  patientName: string,
  message: string,
  sessionId?: string,
  profileId?: string,
): Promise<ReadableStream<Uint8Array>> {
  const url = `${BASE_URL}/api/coach/chat`;
  const body = JSON.stringify({
    ...(profileId ? { profile_id: profileId } : { access_code: accessCode }),
    patient_name: patientName,
    message,
    ...(sessionId ? { session_id: sessionId } : {}),
  });

  const resolvedLanguage = getActiveLocale();
  // B2B (facility) mode requires a staff JWT — the backend rejects a raw
  // profile_id without it. B2C (access_code) mode stays unauthenticated.
  const facilityToken = profileId ? getFacilityToken() : null;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolvedLanguage ? { 'X-App-Locale': resolvedLanguage } : {}),
      ...(facilityToken ? { Authorization: `Bearer ${facilityToken}` } : {}),
    },
    body,
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new ApiError(`Coach chat request failed: ${response.status}`, response.status, errorBody);
  }

  if (!response.body) {
    throw new ApiError('No response body for streaming', 0);
  }

  return response.body;
}

export async function getScenarios(diseaseStage?: string, category?: string): Promise<Scenario[]> {
  const params = new URLSearchParams();
  if (diseaseStage) params.set('disease_stage', diseaseStage);
  if (category) params.set('category', category);
  const query = params.toString();
  const path = `/api/learn/scenarios${query ? `?${query}` : ''}`;
  return request<Scenario[]>(path);
}

export async function interactWithScenario(
  data: LearnInteractRequest,
): Promise<LearnInteractResponse> {
  return request<LearnInteractResponse>('/api/learn/interact', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface ConversationSummary {
  session_id: string;
  title: string;
  created_at: string;
  message_count: number;
}

export async function getConversations(accessCode: string): Promise<ConversationSummary[]> {
  const data = await request<{ conversations: ConversationSummary[] }>(
    `/api/conversations/${encodeURIComponent(accessCode)}`,
  );
  return data.conversations;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export async function getConversationMessages(
  accessCode: string,
  sessionId: string,
): Promise<ConversationMessage[]> {
  const data = await request<{ session_id: string; messages: ConversationMessage[] }>(
    `/api/conversations/${encodeURIComponent(accessCode)}/${encodeURIComponent(sessionId)}/messages`,
  );
  return data.messages;
}

export async function checkIn(
  accessCode: string,
  message: string,
): Promise<ReadableStream<Uint8Array>> {
  const url = `${BASE_URL}/api/checkin`;
  const body = JSON.stringify({ access_code: accessCode, message });

  const resolvedLanguage = getActiveLocale();
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolvedLanguage ? { 'X-App-Locale': resolvedLanguage } : {}),
    },
    body,
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    throw new ApiError(`Check-in request failed: ${response.status}`, response.status, errorBody);
  }

  if (!response.body) {
    throw new ApiError('No response body for streaming', 0);
  }

  return response.body;
}

// ── Insights ──────────────────────────────────────────────────────────────

export interface CoachFrequency {
  this_week: number;
  last_week: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  total_sessions: number;
}

export interface DriftAlert {
  last_count: number;
  this_count: number;
}

export interface EpisodeCycle {
  detected: boolean;
  avg_interval_days: number | null;
  last_episode_date: string | null;
  next_predicted_date: string | null;
  confidence: string | null;
}

export interface CrossPatientBoost {
  cohort: string;
  cohort_size: number;
  strategies: Array<{ tag: string; helped: number; rate: number }>;
}

export interface InsightsPayload {
  crisis_frequency: CoachFrequency;
  peak_time: 'overnight' | 'morning' | 'afternoon' | 'evening';
  drift_alert: DriftAlert | null;
  resolution_rate: number;
  top_triggers: string[];
  effective_strategies: Record<string, number>;
  ineffective_reasons: Record<string, number>;
  episode_cycle: EpisodeCycle | null;
  care_level: string | null;
  top_strategies_for_context: string[];
  cross_patient_boost: CrossPatientBoost | null;
}

export interface InsightsResponse {
  profile_id: string;
  computed_at: string;
  insights: InsightsPayload;
}

export async function getInsights(accessCode: string): Promise<InsightsResponse | null> {
  try {
    return await request<InsightsResponse>(`/api/insights/${encodeURIComponent(accessCode)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// ── Impact ────────────────────────────────────────────────────────────────

export interface ImpactResponse {
  families_supported: number;
  coached_sessions: number;
  languages_served: number;
  overnight_pct: number;
  sessions_this_week: number;
}

export async function getImpact(): Promise<ImpactResponse> {
  return request<ImpactResponse>('/api/impact');
}

// ── Feedback ──────────────────────────────────────────────────────────────

export const PREDEFINED_TAGS = [
  'calm_approach',
  'music',
  'redirection',
  'physical_space',
  'familiar_objects',
  'routine',
  'lighting',
  'simple_words',
  'physical_touch',
  'called_for_help',
  'waited_it_out',
  'left_the_room',
] as const;

export const NEGATIVE_REASON_TAGS = [
  'too_generic',
  'wrong_situation',
  'didnt_understand',
  'felt_unsafe',
  'already_tried',
] as const;

export const TAG_LABELS: Record<string, string> = {
  calm_approach: 'Calm approach',
  music: 'Music',
  redirection: 'Redirection',
  physical_space: 'Physical space',
  familiar_objects: 'Familiar objects',
  routine: 'Routine',
  lighting: 'Lighting',
  simple_words: 'Simple words',
  physical_touch: 'Physical touch',
  called_for_help: 'Called for help',
  waited_it_out: 'Waited it out',
  left_the_room: 'Left the room',
  too_generic: 'Too generic',
  wrong_situation: 'Wrong situation',
  didnt_understand: "Didn't understand",
  felt_unsafe: 'Felt unsafe',
  already_tried: 'Already tried this',
};

export interface FeedbackEntry {
  conversation_id: string;
  helpful: boolean | null;
  tags: string[];
  created_at: string;
}

export interface PendingFeedback {
  session_id: string;
  conversation_id: string;
  title: string;
  suggested_tags: string[];
  created_at: string;
}

export async function submitFeedback(
  accessCode: string,
  conversationId: string,
  helpful: boolean,
  tags: string[],
  negativeReasons: string[],
): Promise<{ id: string }> {
  return request<{ id: string }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({
      access_code: accessCode,
      conversation_id: conversationId,
      helpful,
      tags,
      negative_reasons: negativeReasons,
    }),
  });
}

export async function skipFeedback(accessCode: string, conversationId: string): Promise<void> {
  await request('/api/feedback/skip', {
    method: 'POST',
    body: JSON.stringify({
      access_code: accessCode,
      conversation_id: conversationId,
    }),
  });
}

export async function getSessionFeedback(
  accessCode: string,
  sessionId: string,
): Promise<FeedbackEntry[]> {
  const data = await request<{ feedback: FeedbackEntry[] }>(
    `/api/feedback/${encodeURIComponent(accessCode)}/${encodeURIComponent(sessionId)}`,
  );
  return data.feedback;
}

export async function getPendingFeedback(accessCode: string): Promise<PendingFeedback | null> {
  try {
    return await request<PendingFeedback>(
      `/api/feedback/pending/${encodeURIComponent(accessCode)}`,
    );
  } catch (err) {
    if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return null;
    throw err;
  }
}

// ── Daily Check-in ────────────────────────────────────────────────────────

export interface DailyCheckinEntry {
  id: string;
  check_date: string;
  severity: 'calm' | 'mild' | 'tough';
  time_slot: string | null;
  tags: string[];
  created_at: string;
}

export interface DailyCheckinStatus {
  checked_in: boolean;
  entries: DailyCheckinEntry[];
}

export async function submitDailyCheckin(
  accessCode: string,
  severity: 'calm' | 'mild' | 'tough',
  timeSlot?: string,
  tags?: string[],
): Promise<{ id: string }> {
  return request<{ id: string }>('/api/checkin/daily', {
    method: 'POST',
    body: JSON.stringify({
      access_code: accessCode,
      severity,
      time_slot: timeSlot ?? null,
      tags: tags ?? [],
    }),
  });
}

export async function getDailyCheckinStatus(accessCode: string): Promise<DailyCheckinStatus> {
  return request<DailyCheckinStatus>(`/api/checkin/daily/${encodeURIComponent(accessCode)}/today`);
}

// ── Care Patterns (What We're Noticing) ──────────────────────────────────

export interface CarePatternReason {
  type: string;
  avg_interval_days: number | null;
  days_since_last: number | null;
}

export interface CarePatternData {
  care_level: 'needs_attention' | 'stable';
  reason: CarePatternReason;
  top_strategies: string[];
  cross_patient: {
    cohort_size: number;
    top_strategy: string;
    top_strategy_rate: number;
  } | null;
}

export async function getCarePatterns(accessCode: string): Promise<CarePatternData | null> {
  try {
    return await request<CarePatternData>(`/api/care-patterns/${encodeURIComponent(accessCode)}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return null;
    throw err;
  }
}

// ── Incidents ────────────────────────────────────────────────────────────

export type BehaviorCategory =
  | 'aggression_anger'
  | 'confusion_disorientation'
  | 'wandering_exit_seeking'
  | 'refusing_care'
  | 'sleep_problems'
  | 'hallucinations'
  | 'repetitive_behavior'
  | 'other';

export type SeverityLevel = 'mild' | 'moderate' | 'severe';

export type DurationCategory = 'seconds' | 'minutes' | 'about_an_hour' | 'longer';

export type AntecedentCategory =
  'task_demand' | 'transition' | 'environmental' | 'social' | 'physical_state' | 'unknown';

export type InterventionOutcome = 'resolved' | 'partially_resolved' | 'unresolved' | 'escalated';

export type CaregiverRole = 'spouse' | 'adult_child' | 'paid_aide' | 'other_family' | 'other';

export interface IncidentCreate {
  behavior_category: BehaviorCategory;
  behavior_description: string;
  incident_time: string;
  source?: 'manual' | 'voice';
  severity?: SeverityLevel | null;
  duration_category?: DurationCategory | null;
  antecedent_description?: string | null;
  antecedent_category?: AntecedentCategory | null;
  intervention_description?: string | null;
  intervention_outcome?: InterventionOutcome | null;
  location?: string | null;
  caregiver_role?: CaregiverRole | null;
  is_recurring?: boolean | null;
}

export interface IncidentResponse {
  id: string;
  profile_id: string;
  conversation_id: string | null;
  source: string;
  incident_time: string;
  time_slot: string | null;
  behavior_category: BehaviorCategory;
  behavior_subcategory: string | null;
  severity: SeverityLevel | null;
  duration_category: DurationCategory | null;
  antecedent_description: string | null;
  antecedent_category: AntecedentCategory | null;
  behavior_description: string;
  intervention_description: string | null;
  intervention_outcome: InterventionOutcome | null;
  location: string | null;
  is_recurring: boolean | null;
  caregiver_role: CaregiverRole | null;
  recall_confidence: string;
  extraction_confidence: number | null;
  verified_by_caregiver: boolean;
  created_at: string;
}

export interface IncidentListResponse {
  incidents: IncidentResponse[];
  total: number;
}

export interface IncidentUpdate {
  behavior_category?: BehaviorCategory | null;
  behavior_description?: string | null;
  severity?: SeverityLevel | null;
  antecedent_description?: string | null;
  antecedent_category?: AntecedentCategory | null;
  intervention_description?: string | null;
  intervention_outcome?: InterventionOutcome | null;
  location?: string | null;
  is_recurring?: boolean | null;
}

export interface VerificationPending {
  incident_id: string;
  summary_text: string;
}

export interface VerifyRequest {
  approved: boolean;
  corrections?: IncidentUpdate | null;
}

export interface PatternResponse {
  time_clusters: Record<string, unknown>;
  frequency_trends: Record<string, unknown>;
  effective_interventions: Array<Record<string, unknown>>;
  contraindicated: Array<Record<string, unknown>>;
  escalation_pattern: string | null;
  confidence_level: string;
}

export interface IncidentListParams {
  category?: BehaviorCategory;
  severity?: SeverityLevel;
  since?: string;
  limit?: number;
  offset?: number;
}

export async function createIncident(
  accessCode: string,
  data: IncidentCreate,
): Promise<{ id: string; created_at: string }> {
  return request<{ id: string; created_at: string }>(
    `/api/incidents/${encodeURIComponent(accessCode)}`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

export async function createIncidentByProfile(
  profileId: string,
  data: IncidentCreate,
): Promise<{ id: string; created_at: string }> {
  return request<{ id: string; created_at: string }>(
    `/api/incidents/by-profile/${encodeURIComponent(profileId)}`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

export async function getIncidents(
  accessCode: string,
  params: IncidentListParams = {},
): Promise<IncidentListResponse> {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.severity) searchParams.set('severity', params.severity);
  if (params.since) searchParams.set('since', params.since);
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  const path = `/api/incidents/${encodeURIComponent(accessCode)}${query ? `?${query}` : ''}`;
  return request<IncidentListResponse>(path);
}

export async function getIncident(
  accessCode: string,
  incidentId: string,
): Promise<IncidentResponse> {
  return request<IncidentResponse>(
    `/api/incidents/${encodeURIComponent(accessCode)}/${encodeURIComponent(incidentId)}`,
  );
}

export async function updateIncident(
  accessCode: string,
  incidentId: string,
  data: IncidentUpdate,
): Promise<IncidentResponse> {
  return request<IncidentResponse>(
    `/api/incidents/${encodeURIComponent(accessCode)}/${encodeURIComponent(incidentId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  );
}

export async function verifyIncident(
  accessCode: string,
  incidentId: string,
  data: VerifyRequest,
): Promise<IncidentResponse> {
  return request<IncidentResponse>(
    `/api/incidents/${encodeURIComponent(accessCode)}/verify/${encodeURIComponent(incidentId)}`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

export async function getPatterns(accessCode: string): Promise<PatternResponse | null> {
  try {
    return await request<PatternResponse>(
      `/api/incidents/${encodeURIComponent(accessCode)}/patterns`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getVerificationPending(
  accessCode: string,
): Promise<VerificationPending | null> {
  try {
    const result = await request<VerificationPending | null>(
      `/api/incidents/${encodeURIComponent(accessCode)}/verification-pending`,
    );
    return result;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    return null;
  }
}

// ── Care Changes ─────────────────────────────────────────────────────────

export interface CareChangeCreate {
  change_date: string;
  description: string;
  observation_window_days?: number;
}

export interface CareChangeResponse {
  id: string;
  change_date: string;
  description: string;
  observation_window_days: number;
  is_active: boolean;
  created_at: string;
}

export async function createCareChange(
  accessCode: string,
  data: CareChangeCreate,
): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/care-changes/${encodeURIComponent(accessCode)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCareChanges(
  accessCode: string,
): Promise<{ events: CareChangeResponse[] }> {
  return request<{ events: CareChangeResponse[] }>(
    `/api/care-changes/${encodeURIComponent(accessCode)}`,
  );
}

/**
 * Whether the server can synthesize neural speech for read-aloud.
 *
 * Asked once on mount so the client can decide up front between neural audio
 * and the browser's local voice, instead of finding out per-press via a
 * failed round trip. Never throws: any failure means "use local speech",
 * which is a working experience, not an error worth surfacing.
 */
export async function getSpeechStatus(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/api/speech/status`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return data.available === true;
  } catch {
    return false;
  }
}

/**
 * Synthesize `text` server-side and return playable audio.
 *
 * Returns null rather than throwing when synthesis isn't available (503,
 * network failure, TTS disabled) so callers fall back to local speech on a
 * single null check. The caller owns the returned object URL and must
 * revokeObjectURL it when done.
 */
export async function synthesizeSpeech(text: string): Promise<string | null> {
  try {
    // Measured ~11.7ms/char for neural TTS synthesis (879 chars -> 10.3s).
    // At MAX_TTS_CHARS (4000, see backend/app/services/speech.py) that's
    // ~47s worst case -- comfortably past the default 20s timeout, which
    // silently aborted the request and fell back to the flat local voice
    // after a long dead wait. 60s covers the true worst case with margin.
    const res = await fetchWithTimeout(
      `${BASE_URL}/api/speech`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      },
      60000,
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// Re-export ProfileResponse as Profile for backward compatibility with ProfileContext
export type { ProfileResponse as Profile };
