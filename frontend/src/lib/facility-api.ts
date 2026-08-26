import { getFacilityToken, setFacilityToken, removeFacilityToken } from "./facility-storage";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class FacilityApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "FacilityApiError";
  }
}

async function facilityRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const token = getFacilityToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new FacilityApiError(
      `Facility API request failed: ${response.status}`,
      response.status,
      body,
    );
  }

  return response.json() as Promise<T>;
}

// --- Types ---

export type StaffRole = "staff" | "admin" | "owner";

export interface StaffInfo {
  id: string;
  name: string;
  email: string | null;
  role: StaffRole;
  language_preference: string;
  is_active: boolean;
  last_login_at: string | null;
  assigned_patients_count: number;
  created_at: string;
}

export interface StaffListItem {
  id: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  staff: StaffInfo;
  expires_at: string;
}

export interface FacilityInfo {
  id: string;
  name: string;
  facility_code: string | null;
  patient_count: number;
  staff_count: number;
  default_language: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export type RiskLevel = "low" | "moderate" | "high";
export type TrendDirection = "stable" | "increasing" | "decreasing" | "spike";

export interface ResidentSummary {
  profile_id: string;
  unit: string | null;
  room: string | null;
  bed: string | null;
  disease_stage: string;
  risk_level: RiskLevel;
  top_contraindicated: string | null;
  top_effective: string | null;
  last_incident_summary: string | null;
  trend_direction: TrendDirection;
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

export interface TrendsData {
  incident_frequency: Record<string, number>;
  time_distribution: Record<string, number>;
  intervention_effectiveness: Array<{ intervention: string; success_rate: number; count: number }>;
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

export interface ExecutiveOverview {
  days_active: number;
  incident_rate: { current: number; previous: number; change_pct: number };
  adoption_rate: { staff_pct: number; active_staff: number; total_staff: number };
  roi_estimate: {
    incident_reduction_pct: number;
  };
}

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

export interface AssignmentResponse {
  id: string;
  staff_id: string;
  profile_id: string;
  shift_pattern: string | null;
  is_primary: boolean;
  started_at: string;
}

// --- Auth ---

export async function pinLogin(
  facilityCode: string,
  staffId: string,
  pin: string,
): Promise<AuthResponse> {
  const data = await facilityRequest<AuthResponse>("/api/facility/auth/pin", {
    method: "POST",
    body: JSON.stringify({ facility_code: facilityCode, staff_id: staffId, pin }),
  });
  setFacilityToken(data.token, data.expires_at);
  return data;
}

export async function emailLogin(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await facilityRequest<AuthResponse>("/api/facility/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setFacilityToken(data.token, data.expires_at);
  return data;
}

export async function refreshToken(): Promise<AuthResponse> {
  const data = await facilityRequest<AuthResponse>("/api/facility/auth/refresh", {
    method: "POST",
  });
  setFacilityToken(data.token, data.expires_at);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await facilityRequest("/api/facility/auth/logout", { method: "POST" });
  } finally {
    removeFacilityToken();
  }
}

// --- Staff (for "Who's here?" screen — no auth needed) ---

export async function getActiveStaff(facilityCode: string): Promise<{ staff: StaffListItem[] }> {
  return facilityRequest<{ staff: StaffListItem[] }>(
    `/api/facilities/${encodeURIComponent(facilityCode)}/staff/active`,
  );
}

// --- Facility ---

export async function verifyFacilityCode(
  facilityCode: string,
): Promise<{ id: string; name: string; is_active: boolean }> {
  const url = `${BASE_URL}/api/facilities/${encodeURIComponent(facilityCode)}/verify`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new FacilityApiError("Facility not found", response.status);
  }
  return response.json();
}

export async function getFacility(facilityCode: string): Promise<FacilityInfo> {
  return facilityRequest<FacilityInfo>(
    `/api/facilities/${encodeURIComponent(facilityCode)}`,
  );
}

export async function updateFacility(
  facilityCode: string,
  data: {
    name: string;
    default_language: string;
    timezone: string;
  },
): Promise<FacilityInfo> {
  return facilityRequest<FacilityInfo>(
    `/api/facilities/${encodeURIComponent(facilityCode)}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

// --- CNA Residents ---

export async function getMyResidents(): Promise<{ residents: ResidentSummary[] }> {
  return facilityRequest<{ residents: ResidentSummary[] }>("/api/facility/my-residents");
}

export async function getBehavioralCard(profileId: string): Promise<BehavioralCard> {
  return facilityRequest<BehavioralCard>(
    `/api/facility/residents/${encodeURIComponent(profileId)}/behavioral-card`,
  );
}

// --- Dashboard (DON) ---

export async function getDashboardSummary(hours = 24): Promise<DashboardSummary> {
  return facilityRequest<DashboardSummary>(
    `/api/facility/dashboard/summary?hours=${hours}`,
  );
}

export async function getTrends(period: "7d" | "30d" | "90d" = "7d"): Promise<TrendsData> {
  return facilityRequest<TrendsData>(`/api/facility/dashboard/trends?period=${period}`);
}

export async function getStaffActivity(): Promise<StaffActivity> {
  return facilityRequest<StaffActivity>("/api/facility/dashboard/staff-activity");
}

// --- Executive (Owner) ---

export async function getExecutiveOverview(): Promise<ExecutiveOverview> {
  return facilityRequest<ExecutiveOverview>("/api/facility/executive/overview");
}

// --- Audit ---

export async function getAuditLogs(params?: {
  user_id?: string;
  resource_type?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogList> {
  const searchParams = new URLSearchParams();
  if (params?.user_id) searchParams.set("user_id", params.user_id);
  if (params?.resource_type) searchParams.set("resource_type", params.resource_type);
  if (params?.since) searchParams.set("since", params.since);
  if (params?.until) searchParams.set("until", params.until);
  if (params?.limit !== undefined) searchParams.set("limit", String(params.limit));
  if (params?.offset !== undefined) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString();
  return facilityRequest<AuditLogList>(`/api/facility/audit-logs${query ? `?${query}` : ""}`);
}

// --- Staff Management (Admin) ---

export async function getStaffList(facilityCode: string): Promise<{ staff: StaffInfo[] }> {
  return facilityRequest<{ staff: StaffInfo[] }>(
    `/api/facilities/${encodeURIComponent(facilityCode)}/staff`,
  );
}

export async function createStaff(
  facilityCode: string,
  data: {
    name: string;
    email?: string;
    role?: StaffRole;
    pin?: string;
    password?: string;
    language_preference?: string;
  },
): Promise<StaffInfo> {
  return facilityRequest<StaffInfo>(
    `/api/facilities/${encodeURIComponent(facilityCode)}/staff`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export async function updateStaff(
  facilityCode: string,
  staffId: string,
  data: { name?: string; role?: StaffRole; is_active?: boolean; language_preference?: string },
): Promise<StaffInfo> {
  return facilityRequest<StaffInfo>(
    `/api/facilities/${encodeURIComponent(facilityCode)}/staff/${encodeURIComponent(staffId)}`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export async function deleteStaff(facilityCode: string, staffId: string): Promise<void> {
  await facilityRequest(
    `/api/facilities/${encodeURIComponent(facilityCode)}/staff/${encodeURIComponent(staffId)}`,
    { method: "DELETE" },
  );
}

// --- Patient Linking (Admin) ---

export async function linkPatient(
  facilityCode: string,
  accessCode: string,
  unit?: string,
  room?: string,
  bed?: string,
): Promise<unknown> {
  return facilityRequest(
    `/api/facilities/${encodeURIComponent(facilityCode)}/patients`,
    {
      method: "POST",
      body: JSON.stringify({ access_code: accessCode, unit, room, bed }),
    },
  );
}

export interface ResidentCreateData {
  disease_stage: "early" | "middle" | "late" | "unknown";
  behavioral_patterns?: string[];
  calming_strategies?: string[];
  safety_concerns?: string[];
  unit?: string;
  room?: string;
  bed?: string;
}

export interface ResidentCreateResponse {
  profile_id: string;
  access_code: string;
  disease_stage: string;
  unit: string | null;
  room: string | null;
  bed: string | null;
}

export async function createResident(
  facilityCode: string,
  data: ResidentCreateData,
): Promise<ResidentCreateResponse> {
  return facilityRequest<ResidentCreateResponse>(
    `/api/facilities/${encodeURIComponent(facilityCode)}/residents`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function createIncidentByProfile(
  profileId: string,
  data: object,
): Promise<{ id: string; created_at: string }> {
  return facilityRequest<{ id: string; created_at: string }>(
    `/api/incidents/by-profile/${encodeURIComponent(profileId)}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function getFacilityPatients(facilityCode: string): Promise<{ patients: unknown[] }> {
  return facilityRequest<{ patients: unknown[] }>(
    `/api/facilities/${encodeURIComponent(facilityCode)}/patients`,
  );
}

// --- Assignments (Admin) ---

export async function createAssignment(
  facilityCode: string,
  data: { staff_id: string; profile_id: string; shift_pattern?: string; is_primary?: boolean },
): Promise<AssignmentResponse> {
  return facilityRequest<AssignmentResponse>(
    `/api/facilities/${encodeURIComponent(facilityCode)}/assignments`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export async function deleteAssignment(facilityCode: string, assignmentId: string): Promise<void> {
  await facilityRequest(
    `/api/facilities/${encodeURIComponent(facilityCode)}/assignments/${encodeURIComponent(assignmentId)}`,
    { method: "DELETE" },
  );
}

export async function getAssignments(
  facilityCode: string,
  staffId?: string,
): Promise<{ assignments: AssignmentResponse[] }> {
  const query = staffId ? `?staff_id=${encodeURIComponent(staffId)}` : "";
  return facilityRequest<{ assignments: AssignmentResponse[] }>(
    `/api/facilities/${encodeURIComponent(facilityCode)}/assignments${query}`,
  );
}

export async function downloadReport(days: number = 30): Promise<void> {
  const token = getFacilityToken();
  const res = await fetch(`${BASE_URL}/api/facility/report/pdf?days=${days}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new FacilityApiError(`Report failed: ${res.status}`, res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `calmguide-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
