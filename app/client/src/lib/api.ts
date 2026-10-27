// Cliente API tipado del cliente React (Fase 2). Mismo origen y
// misma sesión por cookie httpOnly que el vanilla: ningún token
// viaja en el código ni en localStorage. Los shapes copian los
// contratos reales de app/src/routes.ts (verificados).

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = (data ?? {}) as { message?: unknown; error?: unknown };
    const message =
      typeof body.message === 'string'
        ? body.message
        : typeof body.error === 'string'
          ? body.error
          : `Error ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export type Role = 'admin' | 'member';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SessionOrg {
  id: string;
  name: string;
}

export interface MeResponse {
  user: SessionUser;
  org: SessionOrg;
}

export interface LoginResponse {
  user: SessionUser;
  org: { id: string };
}

export interface AcceptInvitationResponse {
  user: SessionUser;
  org: { id: string; name: string };
}

export interface StatsResponse {
  opportunities: number;
  openTasks: number;
  pendingDrafts: number;
  failedExecutions: number;
  createdToday?: number;
}

export interface ContactStatusResponse {
  enabled: boolean;
}

export interface ContactResponse {
  ok: boolean;
}

export function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/api/me');
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export function acceptInvitation(
  token: string,
  name: string,
  password: string,
): Promise<AcceptInvitationResponse> {
  return request<AcceptInvitationResponse>('/api/auth/accept-invitation', {
    method: 'POST',
    body: JSON.stringify({ token, name, password }),
  });
}

export function getContactStatus(): Promise<ContactStatusResponse> {
  return request<ContactStatusResponse>('/api/contact/status');
}

export interface ContactInput {
  name: string;
  email: string;
  company: string;
  message: string;
  website: string;
}

export function sendContact(input: ContactInput): Promise<ContactResponse> {
  return request<ContactResponse>('/api/contact', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getStats(): Promise<StatsResponse> {
  return request<StatsResponse>('/api/stats');
}

// Resúmenes mínimos que usa la vista Inicio (Fase 4). Los
// shapes copian los contratos reales de app/src/routes.ts: solo
// los campos que la vista lee; el resto de la fila no se usa.
export interface OpportunitySummary {
  id: string;
  contact_name: string;
  company: string;
  category: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  due_at: string;
  status: string;
}

export interface DraftSummary {
  id: string;
  status: string;
}

export interface ExecutionSummary {
  id: string;
  status: string;
}

export interface AuditEntry {
  actor: string;
  action: string;
  entity: string;
  detail_json: string;
  created_at: string;
}

export function getOpportunities(): Promise<{ opportunities: OpportunitySummary[] }> {
  return request<{ opportunities: OpportunitySummary[] }>('/api/opportunities');
}

export function getOpenTasks(): Promise<{ tasks: TaskSummary[] }> {
  return request<{ tasks: TaskSummary[] }>('/api/tasks?status=open');
}

export function getDrafts(): Promise<{ drafts: DraftSummary[] }> {
  return request<{ drafts: DraftSummary[] }>('/api/drafts');
}

export function getExecutions(): Promise<{ executions: ExecutionSummary[] }> {
  return request<{ executions: ExecutionSummary[] }>('/api/executions');
}

export function getAudit(): Promise<{ audit: AuditEntry[] }> {
  return request<{ audit: AuditEntry[] }>('/api/audit');
}

// Detalle completo de oportunidad, tarea y borrador (R1): los
// shapes copian los contratos reales de app/src/routes.ts
// (SELECT * de cada tabla + joins documentados ahí).
export interface OpportunityDetail {
  id: string;
  contact_name: string;
  contact_email: string;
  company: string;
  message: string;
  source: string;
  status: string;
  category: string;
  priority: string;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface TaskFull {
  id: string;
  opportunity_id: string;
  title: string;
  assigned_to: string;
  agent_id: string;
  status: string;
  due_at: string;
  created_at: string;
  updated_at: string;
  agent_name: string | null;
  contact_name: string;
  company: string;
}

export interface DraftFull {
  id: string;
  opportunity_id: string;
  body: string;
  source_message: string | null;
  status: string;
  note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  contact_name: string;
  company: string;
  opportunity_message: string;
  opportunity_source: string;
  expired: boolean;
  stale: boolean;
}

export function getOpportunityList(): Promise<{ opportunities: OpportunityDetail[] }> {
  return request<{ opportunities: OpportunityDetail[] }>('/api/opportunities');
}

export function getAllTasks(): Promise<{ tasks: TaskFull[] }> {
  return request<{ tasks: TaskFull[] }>('/api/tasks');
}

export function getDraftsDetail(): Promise<{ drafts: DraftFull[] }> {
  return request<{ drafts: DraftFull[] }>('/api/drafts');
}

export function getOpportunityAudit(opportunityId: string): Promise<{ audit: AuditEntry[] }> {
  return request<{ audit: AuditEntry[] }>(`/api/audit?opportunityId=${encodeURIComponent(opportunityId)}`);
}

export interface CreateOpportunityInput {
  contactName: string;
  contactEmail: string;
  company: string;
  message: string;
}

export function createOpportunity(
  input: CreateOpportunityInput,
): Promise<{ opportunity: OpportunityDetail; created: boolean; duplicate: boolean }> {
  return request<{ opportunity: OpportunityDetail; created: boolean; duplicate: boolean }>('/api/opportunities', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
