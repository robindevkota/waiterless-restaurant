const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let _accessToken: string | null = null;

export function setAccessToken(token: string | null) { _accessToken = token; }
export function getAccessToken() { return _accessToken; }

async function request<T>(method: Method, path: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authToken = token ?? _accessToken;
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message || 'Request failed', res.status);
  return data as T;
}

export const api = {
  get:    <T>(path: string, token?: string) => request<T>('GET', path, undefined, token),
  post:   <T>(path: string, body?: unknown, token?: string) => request<T>('POST', path, body, token),
  patch:  <T>(path: string, body?: unknown, token?: string) => request<T>('PATCH', path, body, token),
  put:    <T>(path: string, body?: unknown, token?: string) => request<T>('PUT', path, body, token),
  delete: <T>(path: string, token?: string) => request<T>('DELETE', path, undefined, token),
};

// Token refresh helper — call this when API returns 401
export async function refreshTokens(): Promise<string | null> {
  try {
    const data = await request<{ accessToken: string }>('POST', '/auth/refresh');
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}
