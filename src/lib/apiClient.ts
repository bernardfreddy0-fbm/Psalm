const BASE = import.meta.env.VITE_API_URL as string;

async function tryRefresh(): Promise<string | null> {
  const rt = localStorage.getItem('aef_refresh_token');
  if (!rt) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return null;
    const { access_token } = await res.json();
    localStorage.setItem('aef_token', access_token);
    return access_token;
  } catch {
    return null;
  }
}

async function doFetch(method: string, path: string, options: RequestInit): Promise<Response> {
  const token = localStorage.getItem('aef_token');
  const headers: HeadersInit = {
    ...(options.headers as Record<string, string> ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, method, headers });
  if (res.status === 401) {
    const newToken = await tryRefresh();
    if (newToken) {
      const headers2: HeadersInit = {
        ...(options.headers as Record<string, string> ?? {}),
        Authorization: `Bearer ${newToken}`,
      };
      return fetch(`${BASE}${path}`, { ...options, method, headers: headers2 });
    }
    localStorage.removeItem('aef_token');
    localStorage.removeItem('aef_refresh_token');
  }
  return res;
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await doFetch(method, path, {
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function requestFormData<T>(method: string, path: string, formData: FormData): Promise<T> {
  const res = await doFetch(method, path, { body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
