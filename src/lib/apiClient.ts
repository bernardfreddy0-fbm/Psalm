const BASE = (import.meta.env.VITE_API_URL as string) || 'https://api.a-e-f.fr';

const TOKEN_KEY   = 'aef_admin_token';
const REFRESH_KEY = 'aef_admin_refresh_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function tryRefresh(): Promise<string | null> {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) { clearTokens(); return null; }
    const { access_token, refresh_token } = await res.json() as { access_token: string; refresh_token: string };
    localStorage.setItem(TOKEN_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
    return access_token;
  } catch {
    clearTokens();
    return null;
  }
}

async function doFetch(method: string, path: string, options: {
  body?: unknown;
  isRetry?: boolean;
}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options.isRetry) {
    const newToken = await tryRefresh();
    if (newToken) return doFetch(method, path, { ...options, isRetry: true });
    window.dispatchEvent(new Event('aef:unauthorized'));
  }

  return res;
}

export async function apiFetch<T>(path: string, options: { method?: string; json?: unknown } = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const res    = await doFetch(method, path, { body: options.json });

  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try { const b = await res.json(); msg = b.error || b.message || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const form  = new FormData();
  form.append('file', file);

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (res.status === 401) {
    clearTokens();
    window.dispatchEvent(new Event('aef:unauthorized'));
    throw new Error('Session expirée');
  }
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try { const b = await res.json(); msg = b.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}
