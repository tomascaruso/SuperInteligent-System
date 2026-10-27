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
