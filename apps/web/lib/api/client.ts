import { useAuthStore } from '../auth/store';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        useAuthStore.getState().clear();
        return null;
      }
      const data = (await res.json()) as { user: import('@workra/shared').PublicUser; accessToken: string };
      useAuthStore.getState().setSession(data.user, data.accessToken);
      return data.accessToken;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, auth = true, skipRefresh = false, headers, ...rest } = opts;

  // FormData is sent as multipart; let the browser set Content-Type with the boundary.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const buildHeaders = (token: string | null): HeadersInit => {
    const h = new Headers(headers);
    if (body !== undefined && !isFormData) h.set('Content-Type', 'application/json');
    if (auth && token) h.set('Authorization', `Bearer ${token}`);
    return h;
  };

  const requestBody: BodyInit | undefined =
    body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body);

  const doFetch = async (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...rest,
      headers: buildHeaders(token),
      body: requestBody,
      credentials: 'include',
    });

  let token = useAuthStore.getState().accessToken;
  let res = await doFetch(token);

  if (res.status === 401 && auth && !skipRefresh) {
    const newToken = await performRefresh();
    if (newToken) {
      token = newToken;
      res = await doFetch(token);
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } })
      .error;
    throw new ApiError(
      res.status,
      err?.code ?? 'unknown_error',
      err?.message ?? 'request failed',
      err?.details,
    );
  }

  return payload as T;
}
