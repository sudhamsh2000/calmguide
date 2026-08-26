import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { i18n } from './i18n';
import { clearFacilitySession, getToken, setToken } from './facility-storage';

function getExpoHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const match = hostUri.match(/^(?:https?:\/\/)?(\[[^\]]+\]|[^:/]+)(?::\d+)?$/);
  return match?.[1] ?? null;
}

const PRODUCTION_API_URL = 'https://cgapi.trybabble.io';

export function resolveApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    let resolved: string;
    try {
      const url = new URL(configured);
      const expoHost = getExpoHost();
      if (expoHost && ['0.0.0.0', '127.0.0.1', 'localhost'].includes(url.hostname)) {
        url.hostname = expoHost;
      }
      resolved = url.toString().replace(/\/$/, '');
    } catch {
      resolved = configured.replace(/\/$/, '');
    }
    if (!__DEV__ && !resolved.startsWith('https://')) {
      throw new Error('Production builds must use HTTPS. Set EXPO_PUBLIC_API_URL to an https:// URL.');
    }
    return resolved;
  }
  if (!__DEV__) return PRODUCTION_API_URL;
  const expoHost = getExpoHost();
  if (expoHost) return `http://${expoHost}:8000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

const API_BASE = resolveApiBase();

function localeHeaders(): Record<string, string> {
  return {
    'Accept-Language': i18n.language,
    'X-App-Locale': i18n.language,
  };
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    ...localeHeaders(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (res.status === 401) {
    await clearFacilitySession();
    throw new Error('SESSION_EXPIRED');
  }
  return res;
}

// -- Types --

export interface StaffListItem {
  id: string;
  name: string;
  role: string;
}

export interface StaffDetail {
  id: string;
  name: string;
  email: string | null;
  role: string;
  language_preference: string;
  is_active: boolean;
  last_login_at: string | null;
  assigned_patients_count: number;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  staff: StaffDetail;
  expires_at: string;
}

export interface ResidentCard {
  profile_id: string;
  unit: string | null;
  room: string | null;
  bed: string | null;
  disease_stage: string;
  risk_level: 'low' | 'moderate' | 'high';
  top_contraindicated: string | null;
  top_effective: string | null;
  last_incident_summary: string | null;
  trend_direction: string;
}

export interface BehavioralCard {
  what_works: Array<Record<string, unknown>>;
  what_not_to_do: Array<Record<string, unknown>>;
  escalation_pattern: string | null;
  recent_incidents: Array<{
    date: string;
    category: string;
    severity: string | null;
    outcome: string | null;
  }>;
  delirium_flags: Record<string, unknown> | null;
  pain_flags: Record<string, unknown> | null;
}

export interface DashboardSummary {
  incident_count: { total: number; severe: number; mild: number };
  escalating_residents: Array<{ profile_id: string; category: string; trend: string }>;
  staff_adoption: { active_users: number; total_staff: number; percentage: number };
  family_sessions: { count: number; resolved_without_911: number };
}

export interface StaffCreate {
  name: string;
  email?: string;
  role?: 'staff' | 'admin' | 'owner';
  pin?: string;
  password?: string;
  language_preference?: string;
}

export interface AssignmentCreate {
  staff_id: string;
  profile_id: string;
  shift_pattern?: 'day' | 'evening' | 'night' | 'all';
  is_primary?: boolean;
}

export interface AssignmentResponse {
  id: string;
  staff_id: string;
  profile_id: string;
  shift_pattern: string | null;
  is_primary: boolean;
  started_at: string;
}

// -- Auth (no JWT needed) --

export async function getActiveStaff(facilityCode: string): Promise<StaffListItem[]> {
  const res = await fetch(
    `${API_BASE}/api/facilities/${facilityCode}/staff/active`,
    { headers: localeHeaders() },
  );
  if (!res.ok) throw new Error(`Failed to fetch staff: ${res.status}`);
  const data = await res.json() as { staff: StaffListItem[] };
  return data.staff;
}

export async function pinLogin(
  facilityCode: string,
  staffId: string,
  pin: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/facility/auth/pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...localeHeaders() },
    body: JSON.stringify({ facility_code: facilityCode, staff_id: staffId, pin }),
  });
  if (res.status === 401) {
    const body = await res.json() as { error: string; code: string };
    throw new PinError(body.code);
  }
  if (res.status === 423) {
    throw new PinError('ACCOUNT_LOCKED');
  }
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return res.json() as Promise<AuthResponse>;
}

export async function emailLogin(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/facility/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...localeHeaders() },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { code?: string };
    if (body.code === 'ACCOUNT_LOCKED') throw new PinError('ACCOUNT_LOCKED');
    throw new Error(`Login failed: ${res.status}`);
  }
  return res.json() as Promise<AuthResponse>;
}

export class PinError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'PinError';
  }
}

export async function refreshToken(): Promise<{ token: string; expires_at: string }> {
  const res = await authFetch('/api/facility/auth/refresh', { method: 'POST' });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  const data = await res.json() as { token: string; expires_at: string };
  await setToken(data.token, data.expires_at);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await authFetch('/api/facility/auth/logout', { method: 'POST' });
  } catch { /* best effort */ }
}

// -- Residents (JWT required) --

export async function getMyResidents(): Promise<ResidentCard[]> {
  const res = await authFetch('/api/facility/my-residents');
  if (!res.ok) throw new Error(`Failed to fetch residents: ${res.status}`);
  const data = await res.json() as { residents: ResidentCard[] };
  return data.residents;
}

export async function getBehavioralCard(profileId: string): Promise<BehavioralCard> {
  const res = await authFetch(`/api/facility/residents/${profileId}/behavioral-card`);
  if (res.status === 403) throw new Error('NOT_ASSIGNED');
  if (!res.ok) throw new Error(`Failed to fetch card: ${res.status}`);
  return res.json() as Promise<BehavioralCard>;
}

// -- Dashboard (admin/owner JWT required) --

export async function getDashboardSummary(hours = 24): Promise<DashboardSummary> {
  const res = await authFetch(`/api/facility/dashboard/summary?hours=${hours}`);
  if (!res.ok) throw new Error(`Failed to fetch dashboard: ${res.status}`);
  return res.json() as Promise<DashboardSummary>;
}

export interface TrendsData {
  incident_frequency: Record<string, number>;
  time_distribution: Record<string, number>;
  intervention_effectiveness: Array<{ intervention: string; success_rate: number; count: number }>;
}

export async function getTrends(period: '7d' | '30d' | '90d' = '7d'): Promise<TrendsData> {
  const res = await authFetch(`/api/facility/dashboard/trends?period=${period}`);
  if (!res.ok) throw new Error(`Failed to fetch trends: ${res.status}`);
  return res.json() as Promise<TrendsData>;
}

export interface StaffActivity {
  staff: Array<{
    id: string;
    name: string;
    role: string;
    sessions_this_week: number;
    incidents_logged: number;
    last_active: string | null;
    assigned_patients_count: number;
  }>;
}

export async function getStaffActivity(): Promise<StaffActivity> {
  const res = await authFetch('/api/facility/dashboard/staff-activity');
  if (!res.ok) throw new Error(`Failed to fetch staff activity: ${res.status}`);
  return res.json() as Promise<StaffActivity>;
}

// -- Executive (owner JWT required) --

export interface ExecutiveOverview {
  days_active: number;
  incident_rate: { current: number; previous: number; change_pct: number };
  adoption_rate: { staff_pct: number; active_staff: number; total_staff: number };
  roi_estimate: {
    incident_reduction_pct: number;
  };
}

export async function getExecutiveOverview(): Promise<ExecutiveOverview> {
  const res = await authFetch('/api/facility/executive/overview');
  if (!res.ok) throw new Error(`Failed to fetch executive overview: ${res.status}`);
  return res.json() as Promise<ExecutiveOverview>;
}

// -- Audit (admin/owner JWT required) --

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: string;
  source_ip: string | null;
}

export interface AuditLogList {
  logs: AuditLogEntry[];
  total: number;
}

export async function getAuditLogs(params?: {
  user_id?: string;
  resource_type?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogList> {
  const searchParams = new URLSearchParams();
  if (params?.user_id) searchParams.set('user_id', params.user_id);
  if (params?.resource_type) searchParams.set('resource_type', params.resource_type);
  if (params?.since) searchParams.set('since', params.since);
  if (params?.until) searchParams.set('until', params.until);
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params?.offset !== undefined) searchParams.set('offset', String(params.offset));
  const query = searchParams.toString();
  const res = await authFetch(`/api/facility/audit-logs${query ? `?${query}` : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch audit logs: ${res.status}`);
  return res.json() as Promise<AuditLogList>;
}

// -- Staff Management (admin/owner JWT required) --

export async function getStaffList(facilityCode: string): Promise<StaffDetail[]> {
  const res = await authFetch(`/api/facilities/${facilityCode}/staff`);
  if (!res.ok) throw new Error(`Failed to fetch staff: ${res.status}`);
  const data = await res.json() as { staff: StaffDetail[] };
  return data.staff;
}

export async function createStaff(
  facilityCode: string,
  data: StaffCreate,
): Promise<StaffDetail> {
  const res = await authFetch(`/api/facilities/${facilityCode}/staff`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create staff: ${text}`);
  }
  return res.json() as Promise<StaffDetail>;
}

export type StaffRole = 'staff' | 'admin' | 'owner';

export async function updateStaff(
  facilityCode: string,
  staffId: string,
  data: { name?: string; role?: StaffRole; is_active?: boolean; language_preference?: string },
): Promise<StaffDetail> {
  const res = await authFetch(
    `/api/facilities/${encodeURIComponent(facilityCode)}/staff/${encodeURIComponent(staffId)}`,
    { method: 'PUT', body: JSON.stringify(data) },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update staff: ${text}`);
  }
  return res.json() as Promise<StaffDetail>;
}

export async function deleteStaff(facilityCode: string, staffId: string): Promise<void> {
  const res = await authFetch(
    `/api/facilities/${encodeURIComponent(facilityCode)}/staff/${encodeURIComponent(staffId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) throw new Error(`Failed to delete staff: ${res.status}`);
}

// -- Patient Linking (admin/owner JWT required) --

export async function linkPatient(
  facilityCode: string,
  accessCode: string,
  unit?: string,
  room?: string,
  bed?: string,
): Promise<unknown> {
  const res = await authFetch(
    `/api/facilities/${encodeURIComponent(facilityCode)}/patients`,
    {
      method: 'POST',
      body: JSON.stringify({ access_code: accessCode, unit, room, bed }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to link patient: ${text}`);
  }
  return res.json();
}

export async function getFacilityPatients(facilityCode: string): Promise<{ patients: unknown[] }> {
  const res = await authFetch(`/api/facilities/${encodeURIComponent(facilityCode)}/patients`);
  if (!res.ok) throw new Error(`Failed to fetch patients: ${res.status}`);
  return res.json() as Promise<{ patients: unknown[] }>;
}

// -- Facility Verification (no auth needed) --

export async function verifyFacility(
  facilityCode: string,
): Promise<{ id: string; name: string; is_active: boolean }> {
  const res = await fetch(
    `${API_BASE}/api/facilities/${encodeURIComponent(facilityCode)}/verify`,
  );
  if (!res.ok) throw new Error(`Facility not found: ${res.status}`);
  return res.json() as Promise<{ id: string; name: string; is_active: boolean }>;
}

export async function createAssignment(
  facilityCode: string,
  data: AssignmentCreate,
): Promise<AssignmentResponse> {
  const res = await authFetch(`/api/facilities/${facilityCode}/assignments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create assignment: ${res.status}`);
  return res.json() as Promise<AssignmentResponse>;
}

export async function createResident(
  facilityCode: string,
  data: {
    disease_stage: string;
    behavioral_patterns?: string[];
    calming_strategies?: string[];
    safety_concerns?: string[];
    unit?: string;
    room?: string;
    bed?: string;
  },
): Promise<{ profile_id: string; access_code: string; disease_stage: string }> {
  const res = await authFetch(`/api/facilities/${encodeURIComponent(facilityCode)}/residents`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create resident: ${res.status}`);
  return res.json() as Promise<{ profile_id: string; access_code: string; disease_stage: string }>;
}

export async function createIncidentByProfile(
  profileId: string,
  data: object,
): Promise<{ id: string; created_at: string }> {
  const res = await authFetch(`/api/incidents/by-profile/${encodeURIComponent(profileId)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create incident: ${res.status}`);
  return res.json() as Promise<{ id: string; created_at: string }>;
}

export async function getAssignments(
  facilityCode: string,
  staffId?: string,
): Promise<AssignmentResponse[]> {
  const params = staffId ? `?staff_id=${staffId}` : '';
  const res = await authFetch(`/api/facilities/${facilityCode}/assignments${params}`);
  if (!res.ok) return [];
  const data = await res.json() as { assignments: AssignmentResponse[] };
  return data.assignments;
}

export async function removeAssignment(
  facilityCode: string,
  assignmentId: string,
): Promise<void> {
  const res = await authFetch(`/api/facilities/${facilityCode}/assignments/${assignmentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to remove assignment: ${res.status}`);
}

// -- Facility Info (admin/owner JWT required) --

export interface FacilityInfo {
  id: string;
  name: string;
  facility_code: string | null;
  patient_count: number;
  staff_count: number;
  is_active: boolean;
  created_at: string;
}

export async function getFacility(facilityCode: string): Promise<FacilityInfo> {
  const res = await authFetch(`/api/facilities/${encodeURIComponent(facilityCode)}`);
  if (!res.ok) throw new Error(`Failed to fetch facility: ${res.status}`);
  return res.json() as Promise<FacilityInfo>;
}
