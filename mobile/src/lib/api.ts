import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { i18n } from './i18n';
import { getToken } from './facility-storage';

function getExpoHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  const match = hostUri.match(/^(?:https?:\/\/)?(\[[^\]]+\]|[^:/]+)(?::\d+)?$/);
  return match?.[1] ?? null;
}

function normalizeApiBase(baseUrl: string): string {
  const expoHost = getExpoHost();

  try {
    const url = new URL(baseUrl);
    if (expoHost && ['0.0.0.0', '127.0.0.1', 'localhost'].includes(url.hostname)) {
      url.hostname = expoHost;
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return baseUrl.replace(/\/$/, '');
  }
}

const PRODUCTION_API_URL = 'https://cgapi.trybabble.io';

function resolveApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    const resolved = normalizeApiBase(configured);
    if (!__DEV__ && !resolved.startsWith('https://')) {
      throw new Error(
        'Production builds must use HTTPS. Set EXPO_PUBLIC_API_URL to an https:// URL.',
      );
    }
    return resolved;
  }

  if (!__DEV__) return PRODUCTION_API_URL;

  const expoHost = getExpoHost();
  if (expoHost) return `http://${expoHost}:8000`;

  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

const API_BASE = resolveApiBase();

function getLocaleHeaders(): Record<string, string> {
  return {
    'Accept-Language': i18n.language,
    'X-App-Locale': i18n.language,
  };
}

/** Default timeout for non-streaming JSON calls. Poor 3am cellular can hang
 * a bare fetch() indefinitely (MOBPERF-6); we surface a clear error instead. */
const DEFAULT_FETCH_TIMEOUT_MS = 20000;

export class RequestTimeoutError extends Error {
  constructor(message = 'The request timed out. Check your connection and try again.') {
    super(message);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * fetch() with an AbortController-based timeout. Aborts after `timeoutMs` and
 * throws RequestTimeoutError. Note: this is used only for the plain JSON
 * endpoints — SSE streaming goes through XHR (streamSSE) and is unaffected.
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type DiseaseStage = 'early' | 'middle' | 'late';
export type ScenarioCategory =
  'behavioral' | 'daily_care' | 'safety' | 'communication' | 'self_care';

export interface CreateProfileData {
  disease_stage: DiseaseStage;
  behavioral_patterns: string[];
  calming_strategies: string[];
  safety_concerns: string[];
}

export interface CreateProfileResponse {
  access_code: string;
  disease_stage: DiseaseStage;
  behavioral_patterns: string[];
  calming_strategies: string[];
  safety_concerns: string[];
}

export interface ProfileResponse {
  access_code: string;
  disease_stage: DiseaseStage;
  behavioral_patterns: string[];
  calming_strategies: string[];
  safety_concerns: string[];
}

export interface ConversationSummary {
  session_id: string;
  title: string;
  created_at: string;
  message_count: number;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  category: ScenarioCategory;
}

export interface StreamCoachChatParams {
  access_code?: string;
  profile_id?: string;
  /**
   * Required by the backend CoachRequest schema (min_length=1). Transient —
   * sent on every call but never stored server-side. Omitting it returns 422.
   */
  patient_name: string;
  message: string;
}

export interface StreamCheckInParams {
  access_code: string;
  /**
   * Sent for parity with coach mode; the backend CheckInRequest ignores it
   * today but accepts it (no extra="forbid"). Must be non-empty.
   */
  patient_name: string;
  message: string;
}

export interface ScenarioInteractParams {
  scenario_id: string;
  disease_stage: DiseaseStage;
  message: string;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function createProfile(data: CreateProfileData): Promise<CreateProfileResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/api/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create profile: ${text}`);
  }
  return res.json() as Promise<CreateProfileResponse>;
}

export async function getProfile(accessCode: string): Promise<ProfileResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/api/profiles/${accessCode}`, {
    headers: getLocaleHeaders(),
  });
  if (!res.ok) {
    throw new Error('Profile not found');
  }
  return res.json() as Promise<ProfileResponse>;
}

export async function updateProfile(
  accessCode: string,
  data: Partial<CreateProfileData>,
): Promise<ProfileResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/api/profiles/${accessCode}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update profile: ${text}`);
  }
  return res.json() as Promise<ProfileResponse>;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getConversations(accessCode: string): Promise<ConversationSummary[]> {
  const res = await fetchWithTimeout(`${API_BASE}/api/conversations/${accessCode}`, {
    headers: getLocaleHeaders(),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { conversations: ConversationSummary[] };
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
  const res = await fetchWithTimeout(
    `${API_BASE}/api/conversations/${accessCode}/${sessionId}/messages`,
    { headers: getLocaleHeaders() },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { session_id: string; messages: ConversationMessage[] };
  return data.messages;
}

// ─── Learn ────────────────────────────────────────────────────────────────────

export async function getScenarios(
  diseaseStage?: DiseaseStage,
  category?: ScenarioCategory,
): Promise<Scenario[]> {
  const params = new URLSearchParams();
  if (diseaseStage) params.set('disease_stage', diseaseStage);
  if (category) params.set('category', category);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchWithTimeout(`${API_BASE}/api/learn/scenarios${query}`, {
    headers: getLocaleHeaders(),
  });
  if (!res.ok) return [];
  return res.json() as Promise<Scenario[]>;
}

export async function getScenario(id: string): Promise<Scenario> {
  // No single-item endpoint exists — fetch all and find by id
  const all = await getScenarios();
  const found = all.find((s) => s.id === id);
  if (!found) throw new Error(`Scenario not found: ${id}`);
  return found;
}

export async function interactWithScenario(
  data: ScenarioInteractParams,
): Promise<{ response: string }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/learn/interact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to get scenario response');
  return res.json() as Promise<{ response: string }>;
}

// ─── Insights ────────────────────────────────────────────────────────────────

export interface CrisisFrequency {
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
  crisis_frequency: CrisisFrequency;
  peak_time: 'overnight' | 'morning' | 'afternoon' | 'evening';
  drift_alert: DriftAlert | null;
  resolution_rate: number;
  top_triggers: string[];
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
  const res = await fetchWithTimeout(`${API_BASE}/api/insights/${accessCode}`, {
    headers: getLocaleHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch insights: ${res.status}`);
  return res.json() as Promise<InsightsResponse>;
}

// ─── Impact ──────────────────────────────────────────────────────────────────

export interface ImpactResponse {
  families_supported: number;
  coached_sessions: number;
  languages_served: number;
  overnight_pct: number;
  sessions_this_week: number;
}

export async function getImpact(): Promise<ImpactResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/api/impact`, {
    headers: getLocaleHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch impact: ${res.status}`);
  return res.json() as Promise<ImpactResponse>;
}

// ─── Feedback ────────────────────────────────────────────────────────────────

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

export async function getPendingFeedback(accessCode: string): Promise<PendingFeedback | null> {
  const res = await fetchWithTimeout(`${API_BASE}/api/feedback/pending/${accessCode}`, {
    headers: getLocaleHeaders(),
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) return null;
  return res.json() as Promise<PendingFeedback>;
}

export async function submitFeedback(
  accessCode: string,
  conversationId: string,
  helpful: boolean,
  tags: string[],
  negativeReasons: string[],
): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify({
      access_code: accessCode,
      conversation_id: conversationId,
      helpful,
      tags,
      negative_reasons: negativeReasons,
    }),
  });
  if (!res.ok) {
    if (__DEV__) console.warn(`submitFeedback: non-ok response ${res.status}`);
  }
}

export async function skipFeedback(accessCode: string, conversationId: string): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/api/feedback/skip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify({ access_code: accessCode, conversation_id: conversationId }),
  });
  if (!res.ok) {
    if (__DEV__) console.warn(`skipFeedback: non-ok response ${res.status}`);
  }
}

export async function getSessionFeedback(
  accessCode: string,
  sessionId: string,
): Promise<FeedbackEntry[]> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/feedback/${encodeURIComponent(accessCode)}/${encodeURIComponent(sessionId)}`,
    { headers: getLocaleHeaders() },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { feedback: FeedbackEntry[] };
  return data.feedback;
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
  const res = await fetchWithTimeout(`${API_BASE}/api/checkin/daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify({
      access_code: accessCode,
      severity,
      time_slot: timeSlot ?? null,
      tags: tags ?? [],
    }),
  });
  if (!res.ok) throw new Error(`Check-in failed: ${res.status}`);
  return res.json() as Promise<{ id: string }>;
}

export async function getDailyCheckinStatus(accessCode: string): Promise<DailyCheckinStatus> {
  const res = await fetchWithTimeout(`${API_BASE}/api/checkin/daily/${accessCode}/today`, {
    headers: getLocaleHeaders(),
  });
  if (!res.ok) return { checked_in: false, entries: [] };
  return res.json() as Promise<DailyCheckinStatus>;
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
  const res = await fetchWithTimeout(`${API_BASE}/api/care-patterns/${accessCode}`, {
    headers: getLocaleHeaders(),
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) return null;
  return res.json() as Promise<CarePatternData>;
}

// ── Incidents ────────────────────────────────────────────────────────────────

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

export async function getVerificationPending(
  accessCode: string,
): Promise<VerificationPending | null> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/incidents/${accessCode}/verification-pending`,
    { headers: getLocaleHeaders() },
  );
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) return null;
  return res.json() as Promise<VerificationPending>;
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
  const res = await fetchWithTimeout(`${API_BASE}/api/incidents/${accessCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create incident: ${res.status}`);
  return res.json() as Promise<{ id: string; created_at: string }>;
}

export async function createIncidentByProfile(
  profileId: string,
  data: IncidentCreate,
): Promise<{ id: string; created_at: string }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/incidents/by-profile/${profileId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create incident: ${res.status}`);
  return res.json() as Promise<{ id: string; created_at: string }>;
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
  const res = await fetchWithTimeout(
    `${API_BASE}/api/incidents/${accessCode}${query ? `?${query}` : ''}`,
    { headers: getLocaleHeaders() },
  );
  if (!res.ok) return { incidents: [], total: 0 };
  return res.json() as Promise<IncidentListResponse>;
}

export async function getIncident(
  accessCode: string,
  incidentId: string,
): Promise<IncidentResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/api/incidents/${accessCode}/${incidentId}`, {
    headers: getLocaleHeaders(),
  });
  if (!res.ok) throw new Error(`Incident not found: ${res.status}`);
  return res.json() as Promise<IncidentResponse>;
}

export async function updateIncident(
  accessCode: string,
  incidentId: string,
  data: IncidentUpdate,
): Promise<IncidentResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/api/incidents/${accessCode}/${incidentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update incident: ${res.status}`);
  return res.json() as Promise<IncidentResponse>;
}

export async function verifyIncident(
  accessCode: string,
  incidentId: string,
  data: VerifyRequest,
): Promise<IncidentResponse> {
  const res = await fetchWithTimeout(
    `${API_BASE}/api/incidents/${accessCode}/verify/${incidentId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) throw new Error(`Failed to verify incident: ${res.status}`);
  return res.json() as Promise<IncidentResponse>;
}

export async function getPatterns(accessCode: string): Promise<PatternResponse | null> {
  const res = await fetchWithTimeout(`${API_BASE}/api/incidents/${accessCode}/patterns`, {
    headers: getLocaleHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json() as Promise<PatternResponse>;
}

// ── Care Changes ─────────────────────────────────────────────────────────────

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
  const res = await fetchWithTimeout(`${API_BASE}/api/care-changes/${accessCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getLocaleHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create care change: ${res.status}`);
  return res.json() as Promise<{ id: string }>;
}

export async function getCareChanges(
  accessCode: string,
): Promise<{ events: CareChangeResponse[] }> {
  const res = await fetchWithTimeout(`${API_BASE}/api/care-changes/${accessCode}`, {
    headers: getLocaleHeaders(),
  });
  if (!res.ok) return { events: [] };
  return res.json() as Promise<{ events: CareChangeResponse[] }>;
}

// ─── Streaming helpers ────────────────────────────────────────────────────────

/**
 * Parse a buffer of SSE text, calling onChunk for each text token found.
 * Returns `true` if [DONE] was encountered.
 */
function processSSEBuffer(
  buffer: string,
  onChunk: (text: string) => void,
  onReplace?: (text: string) => void,
): { remaining: string; done: boolean } {
  const parts = buffer.split('\n\n');
  const remaining = parts.pop() ?? '';
  for (const part of parts) {
    if (part.includes('[DONE]')) {
      return { remaining: '', done: true };
    }
    for (const line of part.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return { remaining: '', done: true };
      try {
        const parsed = JSON.parse(data) as { text?: string; replace?: string };
        if (parsed.replace && onReplace) {
          onReplace(parsed.replace);
        } else if (parsed.text) {
          onChunk(parsed.text);
        }
      } catch {
        /* not JSON */
      }
    }
  }
  return { remaining, done: false };
}

/**
 * Stream an SSE endpoint via XHR.
 * fetch + ReadableStream is unreliable in React Native / Expo Go;
 * XHR onprogress is the supported approach for progressive responses.
 */
function streamSSE(
  url: string,
  body: object,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  onReplace?: (text: string) => void,
  extraHeaders?: Record<string, string>,
): () => void {
  const xhr = new XMLHttpRequest();
  xhr.timeout = 60000;
  let processedLength = 0;
  let finished = false;

  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('Cache-Control', 'no-cache');
  for (const [headerName, headerValue] of Object.entries(getLocaleHeaders())) {
    xhr.setRequestHeader(headerName, headerValue);
  }
  if (extraHeaders) {
    for (const [headerName, headerValue] of Object.entries(extraHeaders)) {
      xhr.setRequestHeader(headerName, headerValue);
    }
  }

  xhr.onprogress = () => {
    if (finished) return;
    const newText = xhr.responseText.slice(processedLength);
    processedLength = xhr.responseText.length;
    if (!newText) return;
    const { done } = processSSEBuffer(newText, onChunk, onReplace);
    if (done) {
      finished = true;
      onDone();
    }
  };

  xhr.onload = () => {
    if (finished) return;
    // Process any remaining buffered text
    const newText = xhr.responseText.slice(processedLength);
    if (newText) processSSEBuffer(newText, onChunk, onReplace);
    if (!finished) {
      finished = true;
      onDone();
    }
  };

  xhr.onerror = () => {
    if (!finished) onError(new Error(`Request failed: ${xhr.status}`));
  };

  xhr.ontimeout = () => {
    if (!finished) {
      finished = true;
      onError?.(new Error('Request timed out'));
    }
  };

  xhr.onabort = () => {
    finished = true;
  };

  // Check HTTP status once headers arrive
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED && xhr.status >= 400) {
      finished = true;
      onError(new Error(`HTTP ${xhr.status}`));
      xhr.abort();
    }
  };

  xhr.send(JSON.stringify(body));
  return () => {
    finished = true;
    xhr.abort();
  };
}

export function streamCoachChat(
  params: StreamCoachChatParams,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  onReplace?: (text: string) => void,
): () => void {
  const url = `${API_BASE}/api/coach/chat`;
  // B2B (facility) mode requires a staff JWT — the backend rejects a raw
  // profile_id without it. Resolve the token (SecureStore, async) before
  // opening the stream. B2C (access_code) mode stays unauthenticated.
  if (params.profile_id) {
    let cancelled = false;
    let cancel: (() => void) | null = null;
    getToken()
      .then((token) => {
        if (cancelled) return;
        if (!token) {
          onError(new Error('HTTP 401'));
          return;
        }
        cancel = streamSSE(url, params, onChunk, onDone, onError, onReplace, {
          Authorization: `Bearer ${token}`,
        });
      })
      .catch((err) => onError(err instanceof Error ? err : new Error(String(err))));
    return () => {
      cancelled = true;
      cancel?.();
    };
  }
  return streamSSE(url, params, onChunk, onDone, onError, onReplace);
}

/** @deprecated Use streamCoachChat instead */
export const streamCrisisChat = streamCoachChat;

export function streamCheckIn(
  params: StreamCheckInParams,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  onReplace?: (text: string) => void,
): () => void {
  return streamSSE(`${API_BASE}/api/checkin`, params, onChunk, onDone, onError, onReplace);
}
