const API_BASE = 'https://api-psalm.a-e-f.fr';
const SETTINGS_BASE = 'https://admin-psalm.a-e-f.fr/api';

function getToken(): string {
  return localStorage.getItem('aef_admin_token') || '';
}

export function setToken(token: string) {
  localStorage.setItem('aef_admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('aef_admin_token');
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'X-Session-Token': getToken() },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'API error');
  return json;
}

async function api<T = any>(path: string): Promise<T> {
  const json = await apiFetch<{ data: T }>(`${API_BASE}/${path}`);
  return json.data;
}

// Auth
export async function login(email: string, password: string) {
  const data = await api<{ token: string; user: any }>(
    `auth.php?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
  );
  setToken(data.token);
  return data.user;
}

export async function checkAuth() {
  const res = await fetch(`${API_BASE}/auth.php?action=check`, {
    headers: { 'X-Session-Token': getToken() },
  });
  const json = await res.json();
  if (!json.success || !json.authenticated) return null;
  return json.user;
}

export async function logout() {
  try {
    await fetch(`${API_BASE}/auth.php?action=logout`, {
      headers: { 'X-Session-Token': getToken() },
    });
  } finally {
    clearToken();
  }
}

// Members
export const getMembers = () => api<any[]>('members.php?action=list');
export const createMember = (data: { first_name: string; last_name: string; email: string; role: string; instrument?: string }) => {
  let url = `members.php?action=create&first_name=${encodeURIComponent(data.first_name)}&last_name=${encodeURIComponent(data.last_name)}&email=${encodeURIComponent(data.email)}&role=${encodeURIComponent(data.role)}`;
  if (data.instrument) url += `&instrument=${encodeURIComponent(data.instrument)}`;
  return api(url);
};
export const updateMember = (id: string, data: Record<string, string>) => {
  const params = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return api(`members.php?action=update&id=${id}&${params}`);
};
export const deleteMember = (id: string) => api(`members.php?action=delete&id=${id}`);

// Planning
export const getPlanning = (year: number) => api<any[]>(`sundays.php?action=list&year=${year}`);
export const createSunday = (date: string, label: string) =>
  api(`sundays.php?action=create&date=${date}&label=${encodeURIComponent(label)}`);
export const updateSunday = (id: string, data: Record<string, string>) => {
  const params = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return api(`sundays.php?action=update&id=${id}&${params}`);
};
export const deleteSunday = (id: string) => api(`sundays.php?action=delete&id=${id}`);

// Songs
export const getSongs = () => api<any[]>('songs.php?action=list');
export const createSong = (data: { title: string; author?: string; key?: string; tempo?: string; tags?: string }) => {
  let url = `songs.php?action=create&title=${encodeURIComponent(data.title)}`;
  if (data.author) url += `&author=${encodeURIComponent(data.author)}`;
  if (data.key) url += `&key=${encodeURIComponent(data.key)}`;
  if (data.tempo) url += `&tempo=${encodeURIComponent(data.tempo)}`;
  if (data.tags) url += `&tags=${encodeURIComponent(data.tags)}`;
  return api(url);
};
export const updateSong = (id: string, data: Record<string, string>) => {
  const params = Object.entries(data).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return api(`songs.php?action=update&id=${id}&${params}`);
};
export const deleteSong = (id: string) => api(`songs.php?action=delete&id=${id}`);

// Permissions
export const getPermissions = () => api<{ permissions: Record<string, string[]> }>('permissions.php?action=get_matrix');
export const savePermissions = (matrix: Record<string, string[]>) =>
  api(`permissions.php?action=update&matrix=${encodeURIComponent(JSON.stringify(matrix))}`);

// Settings (different base URL)
export async function getSettings(): Promise<Record<string, string>> {
  const res = await fetch(`${SETTINGS_BASE}/settings.php?action=get`, {
    headers: { 'X-Session-Token': getToken() },
  });
  const json = await res.json();
  if (!json.success) throw new Error('Settings error');
  return json.data;
}

export async function saveSettings(settings: { key: string; value: string }[]) {
  const res = await fetch(`${SETTINGS_BASE}/settings.php?action=bulk_set&settings=${encodeURIComponent(JSON.stringify(settings))}`, {
    headers: { 'X-Session-Token': getToken() },
  });
  const json = await res.json();
  if (!json.success) throw new Error('Settings save error');
  return json;
}

export async function saveSetting(key: string, value: string) {
  const res = await fetch(`${SETTINGS_BASE}/settings.php?action=set&key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`, {
    headers: { 'X-Session-Token': getToken() },
  });
  const json = await res.json();
  if (!json.success) throw new Error('Setting save error');
  return json;
}
