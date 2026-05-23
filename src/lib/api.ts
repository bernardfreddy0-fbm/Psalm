import { apiFetch, apiUpload, getToken, setTokens, clearTokens } from './apiClient';
import { generateSecurePassword } from './security';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Pas d'alias actif — conducteur_louange et responsable_louange sont deux rôles distincts
const LEGACY_ROLE_ALIASES: Record<string, string> = {};

function normalizeRole(role: string): string {
  return LEGACY_ROLE_ALIASES[role] || role;
}

function normalizeRoleCsv(roleValue?: string | null): string {
  if (!roleValue) return '';
  return [...new Set(roleValue.split(',').map(r => normalizeRole(r.trim())).filter(Boolean))].join(',');
}

function isActiveMember(member: any): boolean {
  return member?.is_active !== false && member?.first_name !== '[Supprimé]';
}

function normalizeMember(member: any) {
  return { ...member, role: normalizeRoleCsv(member?.role) };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function setToken(token: string) {
  localStorage.setItem('aef_admin_token', token);
}
export function clearToken() {
  clearTokens();
}

export async function login(email: string, password: string) {
  const res = await apiFetch<{ access_token: string; refresh_token?: string; user?: any }>('/auth/login', {
    method: 'POST',
    json: { email, password },
  });
  setTokens(res.access_token, res.refresh_token ?? '');
  // Récupérer le profil courant après login
  const profile = await apiFetch<any>('/members/me');
  return profile;
}

export async function checkAuth() {
  try {
    const token = getToken();
    if (!token) return null;
    const profile = await apiFetch<any>('/members/me');
    return profile;
  } catch {
    return null;
  }
}

export async function logout() {
  clearTokens();
}

// ── Members ───────────────────────────────────────────────────────────────────

export const getMembers = async () => {
  const data = await apiFetch<any[]>('/members');
  return (data || []).filter(isActiveMember).map(normalizeMember);
};

// Version complète pour la gestion DSI (inclut created_at + tous les inactifs)
export const getAllAccounts = async () => {
  const data = await apiFetch<any[]>('/members');
  return (data || [])
    .filter((m: any) => m.first_name !== '[Supprimé]')
    .map(normalizeMember);
};

export const createMember = async (data: { first_name: string; last_name: string; email: string; role: string; phone?: string; instrument?: string; password?: string }) => {
  const passwordUsed = data.password ?? generateSecurePassword(16);
  const res = await apiFetch<{ id: string; password: string }>('/members', {
    method: 'POST',
    json: {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      role: data.role,
      phone: data.phone || null,
      instrument: data.instrument || null,
      password: passwordUsed,
      is_active: true,
    },
  });
  await logSecurityEvent('account_created', { target_email: data.email, role: data.role }).catch(() => {});
  return { id: res.id, password: res.password ?? passwordUsed };
};

export const updateMember = async (id: string, data: Record<string, any>) => {
  const payload: any = { ...data };
  if (data.is_active !== undefined) payload.is_active = data.is_active !== '0' && data.is_active !== false;
  await apiFetch(`/members/${id}`, { method: 'PUT', json: payload });
  return { success: true };
};

export const updateMemberEmail = async (userId: string, newEmail: string) => {
  await apiFetch(`/members/${userId}/email`, { method: 'PUT', json: { email: newEmail } });
  return { success: true };
};

// ── Journal d'audit sécurité ──────────────────────────────────────────────────

export async function logSecurityEvent(event: string, meta?: Record<string, any>) {
  try {
    const token = getToken();
    const actor = token ? 'admin' : 'system';
    const key = `secaudit_${Date.now()}_${event}`;
    await apiFetch(`/config/${key}`, {
      method: 'PUT',
      json: { value: JSON.stringify({ event, actor, meta, ts: new Date().toISOString() }) },
    });
  } catch {
    // Log silencieux — ne jamais bloquer l'action principale
    console.warn('[SECURITY AUDIT]', event, meta);
  }
}

export const deleteMember = async (id: string) => {
  await apiFetch(`/members/${id}`, { method: 'DELETE' });
  await logSecurityEvent('account_deleted', { target_id: id }).catch(() => {});
};

export const resetMemberPassword = async (userId: string, newPassword: string) => {
  await apiFetch(`/members/${userId}/reset-password`, { method: 'POST', json: { password: newPassword } });
  await logSecurityEvent('password_reset', { target_id: userId }).catch(() => {});
  return { success: true };
};

// ── Planning / Sundays ───────────────────────────────────────────────────────

export const getPlanning = async (year: number) => {
  const data = await apiFetch<any[]>(`/planning/${year}`);
  return (data || []).map((s: any) => ({
    ...s,
    id: String(s.id),
    assignments: s.assignments || s.sunday_assignments || [],
  }));
};

export const createSunday = async (date: string, label: string) => {
  const data = await apiFetch<any>('/planning/sunday', {
    method: 'POST',
    json: { date, label },
  });
  return data;
};

export const updateSunday = async (id: string, data: Record<string, any>) => {
  await apiFetch(`/planning/sunday/${id}`, { method: 'PUT', json: data });
  return { success: true };
};

export const deleteSunday = async (id: string) => {
  await apiFetch(`/planning/sunday/${id}`, { method: 'DELETE' });
};

// ── Songs ─────────────────────────────────────────────────────────────────────

export interface AdminSong {
  id: string;
  title: string;
  author?: string;
  key?: string;
  key_note?: string;
  tempo?: string;
  tags?: string;
  link?: string;
  youtube_url?: string;
  lyrics?: string;
  partition_url?: string | null;
  audio_url?: string | null;
  folder?: string | null;
}

export const getSongs = async (): Promise<AdminSong[]> => {
  const data = await apiFetch<any[]>('/songs');
  return (data || []).map((s: any) => ({
    ...s,
    id: String(s.id),
    key: s.key_note,
    link: s.youtube_url,
  }));
};

export const getSongFolders = async (): Promise<string[]> => {
  const data = await apiFetch<any[]>('/songs');
  return [...new Set((data || []).map((s: any) => s.folder).filter(Boolean))];
};

export const createSong = async (data: { title: string; author?: string; key?: string; tempo?: string; tags?: string }) => {
  await apiFetch('/songs', {
    method: 'POST',
    json: {
      title: data.title,
      author: data.author || null,
      key_note: data.key || null,
      tempo: data.tempo || null,
      tags: data.tags || null,
    },
  });
};

export const updateSong = async (id: string, data: Record<string, any>) => {
  const payload: any = { ...data };
  if (data.key !== undefined) { payload.key_note = data.key; delete payload.key; }
  if (data.link !== undefined) { payload.youtube_url = data.link; delete payload.link; }
  await apiFetch(`/songs/${id}`, { method: 'PUT', json: payload });
};

export const deleteSong = async (id: string) => {
  await apiFetch(`/songs/${id}`, { method: 'DELETE' });
};

export const uploadPartition = async (songId: string, file: File): Promise<{ partition_url: string }> => {
  const res = await apiUpload<{ partition_url: string }>(`/songs/${songId}/partition`, file);
  return res;
};

export const deletePartition = async (songId: string) => {
  await apiFetch(`/songs/${songId}`, { method: 'PUT', json: { partition_url: null } });
};

// ── Permissions ───────────────────────────────────────────────────────────────

export const getPermissions = async (): Promise<{ permissions: Record<string, string[]> }> => {
  const data = await apiFetch<any[]>('/permissions');
  const permissions: Record<string, string[]> = {};
  for (const row of data || []) {
    const key = row.permission_key || row.key;
    // L'API renvoie roles comme string CSV — on parse en tableau
    const rolesRaw = row.roles;
    permissions[key] = typeof rolesRaw === 'string'
      ? rolesRaw.split(',').map((r: string) => r.trim()).filter(Boolean)
      : (Array.isArray(rolesRaw) ? rolesRaw : []);
  }
  return { permissions };
};

export async function savePermissions(matrix: Record<string, string[]>) {
  const token = getToken();
  if (!token) throw new Error('Non connecté');

  await Promise.all(
    Object.entries(matrix).map(([key, roles]) =>
      // L'API attend roles comme string CSV
      apiFetch(`/permissions/${key}`, { method: 'PUT', json: { roles: roles.join(',') } })
    )
  );
  return { success: true };
}

// ── Protection de compte (réservé au rôle dev) ────────────────────────────────

/**
 * Accorde ou retire la protection d'un compte.
 * Seul l'utilisateur ayant le rôle 'dev' peut appeler cet endpoint.
 */
export const setMemberProtected = async (memberId: string, protect: boolean): Promise<void> => {
  await apiFetch(`/members/${memberId}/protected`, {
    method: 'PUT',
    json: { protected: protect },
  });
};

// ── Permissions par membre (style Active Directory) ───────────────────────────

export interface MemberPermissions {
  via_role: string[];   // accordées par le rôle (lecture seule)
  direct:   string[];   // accordées directement à l'utilisateur
  effective: string[];  // union via_role ∪ direct
}

export const getMemberPermissions = async (memberId: string): Promise<MemberPermissions> => {
  return apiFetch<MemberPermissions>(`/members/${memberId}/permissions`);
};

export const setMemberPermissions = async (memberId: string, permKeys: string[]): Promise<void> => {
  await apiFetch(`/members/${memberId}/permissions`, {
    method: 'PUT',
    json: { permissions: permKeys },
  });
};

// ── Events (multi-day) ────────────────────────────────────────────────────────

export interface SpecialEvent {
  id?: string;
  title: string;
  date_start: string;
  date_end?: string;
  type: 'special' | 'conference' | 'camp' | 'formation' | 'autre';
  description?: string;
  location?: string;
}

export const getSpecialEvents = async (): Promise<SpecialEvent[]> => {
  const data = await apiFetch<any[]>('/events');
  return (data || []).map((e: any) => ({
    id: String(e.id),
    title: e.title,
    date_start: e.date || e.date_start,
    date_end: e.end_date || e.date_end || undefined,
    type: (e.type as SpecialEvent['type']) || 'special',
    description: e.description || undefined,
    location: e.location || undefined,
  }));
};

export async function createSpecialEvent(data: Omit<SpecialEvent, 'id'>) {
  await apiFetch('/events', {
    method: 'POST',
    json: {
      title: data.title,
      date: data.date_start,
      end_date: data.date_end || null,
      type: data.type || null,
      description: data.description || null,
      location: data.location || null,
    },
  });
  return { success: true };
}

export async function updateSpecialEvent(id: string, data: Partial<SpecialEvent>) {
  await apiFetch(`/events/${id}`, {
    method: 'PUT',
    json: {
      title: data.title,
      date: data.date_start,
      end_date: data.date_end || null,
      type: data.type || null,
      description: data.description || null,
      location: data.location || null,
    },
  });
  return { success: true };
}

export const deleteSpecialEvent = async (id: string) => {
  await apiFetch(`/events/${id}`, { method: 'DELETE' });
};

// ── Config / Settings ─────────────────────────────────────────────────────────

export async function getSettingsByCategory(category: string): Promise<any[]> {
  const data = await apiFetch<Record<string, any>>('/config');
  const result: any[] = [];
  for (const [key, value] of Object.entries(data || {})) {
    if (key.startsWith(`${category}_`)) {
      result.push({ key_name: key.replace(`${category}_`, ''), value });
    }
  }
  return result;
}

export async function getAllSettings(): Promise<Record<string, any[]>> {
  const data = await apiFetch<Record<string, any>>('/config');
  const result: Record<string, any[]> = {};
  for (const [key, value] of Object.entries(data || {})) {
    const [cat, ...rest] = key.split('_');
    if (!result[cat]) result[cat] = [];
    result[cat].push({ key_name: rest.join('_'), value });
  }
  return result;
}

export async function saveSetting(category: string, key: string, value: any) {
  const fullKey = `${category}_${key}`;
  await apiFetch(`/config/${fullKey}`, {
    method: 'PUT',
    json: { value: typeof value === 'string' ? value : JSON.stringify(value) },
  });
  return { success: true };
}

export async function saveSettingsBulk(settings: { category: string; key: string; value: any }[]) {
  await Promise.all(
    settings.map(s =>
      apiFetch(`/config/${s.category}_${s.key}`, {
        method: 'PUT',
        json: { value: typeof s.value === 'string' ? s.value : JSON.stringify(s.value) },
      })
    )
  );
  return { success: true };
}

export async function getSettings(): Promise<Record<string, string>> {
  const data = await apiFetch<Record<string, any>>('/config');
  return data as Record<string, string>;
}

export async function saveSettings(settings: { key: string; value: string }[]) {
  await Promise.all(
    settings.map(s =>
      apiFetch(`/config/${s.key}`, { method: 'PUT', json: { value: s.value } })
    )
  );
  return { success: true };
}

export async function getSystemStats() {
  const [members, songs, planning] = await Promise.allSettled([
    apiFetch<any[]>('/members'),
    apiFetch<any[]>('/songs'),
    apiFetch<any[]>(`/planning/${new Date().getFullYear()}`),
  ]);
  return {
    members: members.status === 'fulfilled' ? (members.value || []).length : 0,
    songs:   songs.status === 'fulfilled'   ? (songs.value   || []).length : 0,
    sundays: planning.status === 'fulfilled' ? (planning.value || []).length : 0,
  };
}

export async function clearCache() { return { success: true }; }
export function getBackupUrl(): string { return ''; }

// ── Programme du culte ────────────────────────────────────────────────────────

export async function saveProgram(date: string, data: object) {
  await apiFetch(`/config/programme_${date}`, {
    method: 'PUT',
    json: { value: JSON.stringify(data) },
  });
  return { success: true };
}

export async function loadPrograms(): Promise<Array<{ key_name: string; value: string }>> {
  const data = await apiFetch<Record<string, any>>('/config');
  return Object.entries(data || {})
    .filter(([key]) => key.startsWith('programme_'))
    .map(([key, value]) => ({
      key_name: key.replace('programme_', ''),
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
}

// ── Runsheet ──────────────────────────────────────────────────────────────────

export interface RunsheetItem {
  id?: string;
  sunday_id?: string;
  position: number;
  type: 'chant' | 'priere' | 'predication' | 'annonce' | 'autre';
  title: string;
  duration_min: number;
  notes?: string | null;
  song_id?: string | null;
  is_published?: boolean;
}

export interface RunsheetData {
  items: RunsheetItem[];
  start_time: string;
}

export async function getRunsheet(sundayId: string): Promise<RunsheetData> {
  try {
    const data = await apiFetch<{ items: any[]; start_time: string }>(`/planning/sunday/${sundayId}/runsheet`);
    return {
      items: (data.items || []).map((r: any) => ({ ...r, id: String(r.id), song_id: r.song_id ? String(r.song_id) : null })),
      start_time: data.start_time || '10:00',
    };
  } catch {
    return { items: [], start_time: '10:00' };
  }
}

export async function saveRunsheet(sundayId: string, items: RunsheetItem[]): Promise<void> {
  await apiFetch(`/planning/sunday/${sundayId}/runsheet`, {
    method: 'PUT',
    json: { items: items.map((item, i) => ({
      position: item.position ?? i,
      type: item.type,
      title: item.title,
      duration_min: item.duration_min,
      notes: item.notes || null,
      song_id: item.song_id || null,
      is_published: item.is_published ?? false,
    })) },
  });
}

export async function publishRunsheet(sundayId: string, published: boolean): Promise<void> {
  await apiFetch(`/planning/sunday/${sundayId}/runsheet/publish`, {
    method: 'PUT',
    json: { is_published: published },
  });
}

export async function updateRunsheetStartTime(sundayId: string, startTime: string): Promise<void> {
  await apiFetch(`/planning/sunday/${sundayId}`, {
    method: 'PUT',
    json: { start_time: startTime },
  });
}

// ── Activity logs (journal d'activité) ────────────────────────────────────────

export interface ActivityLog {
  id: string;
  type: 'absence' | 'dispo' | 'member' | 'planning' | 'song';
  action: string;
  description: string;
  user_name: string;
  detail?: string;
  created_at: string;
}

export async function getActivityLogs(params?: {
  limit?: number;
  offset?: number;
  type?: string;
}): Promise<{ data: ActivityLog[]; items: ActivityLog[]; total: number }> {
  const limit = params?.limit ?? 20;
  const logs: ActivityLog[] = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  const [absencesRes, disposRes, membersRes, planningRes, songsRes] = await Promise.allSettled([
    apiFetch<any[]>('/absences'),
    apiFetch<any[]>('/disponibilites'),
    apiFetch<any[]>('/members'),
    apiFetch<any[]>(`/planning/${new Date().getFullYear()}`),
    apiFetch<any[]>('/songs'),
  ]);

  if (absencesRes.status === 'fulfilled') {
    for (const a of (absencesRes.value || []).slice(0, 40)) {
      const name = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'Membre';
      const dateStr = a.date_start
        ? new Date(a.date_start + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : undefined;
      logs.push({
        id: `abs_${a.id}`,
        type: 'absence',
        action: 'absence_declared',
        description: `${name} a déclaré une absence`,
        user_name: name,
        detail: dateStr,
        created_at: a.created_at || new Date().toISOString(),
      });
    }
  }

  if (disposRes.status === 'fulfilled') {
    for (const d of (disposRes.value || []).slice(0, 40)) {
      const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || 'Membre';
      const statusLabel = d.available ? 'disponible' : 'indisponible';
      logs.push({
        id: `dispo_${d.id}`,
        type: 'dispo',
        action: 'dispo_updated',
        description: `${name} s'est marqué ${statusLabel}`,
        user_name: name,
        detail: undefined,
        created_at: d.responded_at || new Date().toISOString(),
      });
    }
  }

  if (membersRes.status === 'fulfilled') {
    for (const p of (membersRes.value || []).slice(0, 20)) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
      if (!name) continue;
      logs.push({
        id: `profile_${p.id}`,
        type: 'member',
        action: 'member_created',
        description: `Nouveau membre : ${name}`,
        user_name: name,
        detail: p.role ? p.role.split(',')[0].replace(/_/g, ' ') : 'Membre',
        created_at: p.created_at || new Date().toISOString(),
      });
    }
  }

  if (planningRes.status === 'fulfilled') {
    for (const s of (planningRes.value || []).slice(0, 20)) {
      const dateStr = s.date
        ? new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : undefined;
      logs.push({
        id: `sunday_${s.id}`,
        type: 'planning',
        action: 'planning_updated',
        description: `Planning modifié : ${s.label || 'Culte'}`,
        user_name: 'Administrateur',
        detail: dateStr,
        created_at: s.updated_at || new Date().toISOString(),
      });
    }
  }

  if (songsRes.status === 'fulfilled') {
    for (const s of (songsRes.value || []).slice(0, 15)) {
      logs.push({
        id: `song_${s.id}`,
        type: 'song',
        action: 'song_created',
        description: `Nouveau chant : ${s.title}`,
        user_name: s.author || 'Inconnu',
        detail: s.author || undefined,
        created_at: s.created_at || new Date().toISOString(),
      });
    }
  }

  logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filtered = params?.type ? logs.filter(l => l.type === params.type) : logs;
  const page = filtered.slice(params?.offset ?? 0, (params?.offset ?? 0) + limit);
  return { data: page, items: page, total: filtered.length };
}

export async function getActivitySummary(days = 7): Promise<Record<string, number>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [absences, dispos, members, songs] = await Promise.allSettled([
    apiFetch<any[]>('/absences'),
    apiFetch<any[]>('/disponibilites'),
    apiFetch<any[]>('/members'),
    apiFetch<any[]>('/songs'),
  ]);

  const cutoffStr = cutoff.toISOString();
  const countSince = (items: any[], dateField: string) =>
    (items || []).filter((x: any) => x[dateField] && x[dateField] >= cutoffStr).length;

  return {
    absences: absences.status === 'fulfilled' ? countSince(absences.value, 'created_at') : 0,
    dispos:   dispos.status === 'fulfilled'   ? countSince(dispos.value, 'responded_at') : 0,
    members:  members.status === 'fulfilled'  ? countSince(members.value, 'created_at') : 0,
    songs:    songs.status === 'fulfilled'    ? countSince(songs.value, 'created_at') : 0,
  };
}

export async function getActivityActions() {
  return [
    { value: 'absence',  label: 'Absences',         emoji: '🙅' },
    { value: 'dispo',    label: 'Disponibilités',    emoji: '📅' },
    { value: 'member',   label: 'Membres',           emoji: '👤' },
    { value: 'planning', label: 'Planning',          emoji: '🗓️' },
    { value: 'song',     label: 'Chants',            emoji: '🎵' },
  ];
}

// ── Disponibilités (vue admin) ────────────────────────────────────────────────

export interface DispoEntry {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  available: boolean | null;
  note: string | null;
  responded_at: string | null;
}

export interface NonRespondant {
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface SundayDispo {
  sunday_id: string;
  date: string;
  label: string;
  is_jeunesse: boolean;
  dispo_deadline: string | null;
  responses: DispoEntry[];
  non_respondants: NonRespondant[];
  total_members: number;
  responded_count: number;
  available_count: number;
}

export async function getDisponibilitesAdmin(year?: number): Promise<SundayDispo[]> {
  const y = year ?? new Date().getFullYear();
  // Utilise l'endpoint admin dédié qui retourne toutes les réponses + non_respondants
  const data = await apiFetch<any[]>(`/disponibilites/admin?year=${y}`);
  return (data || []).map((s: any) => ({
    sunday_id: String(s.sunday_id),
    date: s.date,
    label: s.label ?? '',
    is_jeunesse: !!s.is_jeunesse,
    dispo_deadline: s.dispo_deadline ?? null,
    responses: (s.responses ?? []).map((r: any) => ({
      user_id: r.user_id,
      first_name: r.first_name ?? '',
      last_name: r.last_name ?? '',
      role: r.role ?? '',
      available: r.available ?? null,
      note: r.note ?? null,
      responded_at: r.responded_at ?? null,
    })),
    non_respondants: (s.non_respondants ?? []).map((m: any) => ({
      user_id: m.user_id,
      first_name: m.first_name ?? '',
      last_name: m.last_name ?? '',
      role: m.role ?? '',
    })),
    total_members: s.total_members ?? 0,
    responded_count: s.responded_count ?? 0,
    available_count: s.available_count ?? 0,
  }));
}

export async function setDispoDeadline(sundayId: string, deadline: string | null): Promise<void> {
  await apiFetch(`/planning/sunday/${sundayId}`, {
    method: 'PUT',
    json: { dispo_deadline: deadline },
  });
}

// ── Absences (vue admin) ──────────────────────────────────────────────────────

export interface AdminAbsence {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  date_start: string;
  date_end: string | null;
  reason: string | null;
  created_at: string;
}

export async function getAbsencesAdmin(year?: number): Promise<AdminAbsence[]> {
  const y = year ?? new Date().getFullYear();
  const data = await apiFetch<any[]>('/absences');
  return (data || [])
    .filter((a: any) => a.date_start >= `${y}-01-01` && a.date_start <= `${y}-12-31`)
    .sort((a: any, b: any) => b.date_start.localeCompare(a.date_start))
    .map((a: any) => ({
      id: String(a.id),
      user_id: a.user_id,
      first_name: a.first_name || '',
      last_name: a.last_name || '',
      role: a.role || '',
      date_start: a.date_start,
      date_end: a.date_end || null,
      reason: a.reason || null,
      created_at: a.created_at,
    }));
}

export async function deleteAbsenceAdmin(id: string): Promise<void> {
  await apiFetch(`/absences/${id}`, { method: 'DELETE' });
}

// ── Archives vidéo (video_meta) ───────────────────────────────────────────────

export type VideoStatus = 'brut' | 'montage' | 'validation' | 'publie';

export const STATUS_LABELS: Record<VideoStatus, string> = {
  brut:       'Brut',
  montage:    'Montage',
  validation: 'Validation',
  publie:     'Publié',
};

export const STATUS_COLORS: Record<VideoStatus, { bg: string; text: string }> = {
  brut:       { bg: 'bg-blue-500/15',    text: 'text-blue-400' },
  montage:    { bg: 'bg-amber-500/15',   text: 'text-amber-400' },
  validation: { bg: 'bg-purple-500/15',  text: 'text-purple-400' },
  publie:     { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
};

export interface VideoMetaSummary {
  video_id:    string;
  sunday_id:   number | null;
  preacher:    string | null;
  theme:       string | null;
  status:      VideoStatus;
  assigned_to: string | null;
  filmed_by:   string | null;
  checklist: {
    montage:        boolean;
    subtitles:      boolean;
    thumbnail:      boolean;
    description_yt: boolean;
    published:      boolean;
  };
  updated_at: string | null;
}

export interface AEFVMember {
  id:         string;
  first_name: string;
  last_name:  string;
  role:       string | null;
  phone:      string | null;
  email:      string;
}

export interface VideoAssignment {
  assignment_id: number;
  sunday_id:     number;
  sunday_date:   string;
  sunday_label:  string | null;
  videaste: {
    id:         string;
    first_name: string;
    last_name:  string;
    phone:      string | null;
  };
  assigned_by: string | null;
  note:        string | null;
  created_at:  string | null;
}

export async function getVideoMetaList(): Promise<VideoMetaSummary[]> {
  return apiFetch<VideoMetaSummary[]>('/archives');
}

export async function deleteVideoMeta(videoId: string): Promise<void> {
  await apiFetch(`/archives/${videoId}`, { method: 'DELETE' });
}

export async function getAEFVTeam(): Promise<AEFVMember[]> {
  return apiFetch<AEFVMember[]>('/archives/team');
}

export async function getVideoAssignments(year: number, month: number): Promise<VideoAssignment[]> {
  return apiFetch<VideoAssignment[]>(`/archives/assignments/${year}/${month}`);
}

export async function saveVideoAssignment(sundayId: number, videasteId: string, note?: string): Promise<void> {
  await apiFetch(`/archives/assignments/${sundayId}`, {
    method: 'PUT',
    json: { videaste_id: videasteId, note: note ?? null },
  });
}

export async function removeVideoAssignment(sundayId: number): Promise<void> {
  await apiFetch(`/archives/assignments/${sundayId}`, { method: 'DELETE' });
}

// ── Programme du culte ────────────────────────────────────────────────────────

export type SequenceType = 'louange' | 'prédication' | 'prière' | 'annonces' | 'témoignage' | 'autre';

export interface ProgrammeSequence {
  ordre:  number;
  type:   SequenceType;
  titre:  string;
  notes:  string;
}

export interface ProgrammeCulte {
  id:                number;
  sunday_id:         number;
  submitted_by_name: string;
  submitted_at:      string;
  sequences:         ProgrammeSequence[];
  notes:             string | null;
}

export interface NextSundayAssignment {
  videaste_id: string;
  first_name:  string;
  last_name:   string;
  phone:       string | null;
  role:        string | null;
  note:        string | null;
}

export interface NextSunday {
  sunday_id:     number;
  sunday_date:   string;
  sunday_label:  string | null;
  assignment:    NextSundayAssignment | null;
  has_programme: boolean;
}

export const SEQUENCE_TYPE_LABELS: Record<SequenceType, string> = {
  louange:     'Louange',
  prédication: 'Prédication',
  prière:      'Prière',
  annonces:    'Annonces',
  témoignage:  'Témoignage',
  autre:       'Autre',
};

export async function getNextSundays(): Promise<NextSunday[]> {
  return apiFetch<NextSunday[]>('/archives/next-sundays');
}

export async function getProgrammeCulte(sundayId: number): Promise<ProgrammeCulte | null> {
  try {
    return await apiFetch<ProgrammeCulte | null>(`/archives/programme-culte/${sundayId}`);
  } catch {
    return null;
  }
}

export async function submitProgrammeCulte(data: {
  sunday_id:  number;
  sequences:  ProgrammeSequence[];
  notes?:     string | null;
}): Promise<void> {
  await apiFetch('/archives/programme-culte', { method: 'POST', json: data });
}

// ── Prédications / Sermons ────────────────────────────────────────────────────

export interface Sermon {
  id?: string;
  title: string;
  date: string;
  preacher: string;
  scripture?: string | null;
  series?: string | null;
  notes?: string | null;
  youtube_url?: string | null;
}

export async function getSermons(): Promise<Sermon[]> {
  try {
    const data = await apiFetch<Record<string, any>>('/config');
    return Object.entries(data || {})
      .filter(([key]) => key.startsWith('sermon_'))
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, value]) => {
        try { return { id: key, ...(typeof value === 'string' ? JSON.parse(value) : value) }; }
        catch { return null; }
      }).filter(Boolean) as Sermon[];
  } catch {
    return [];
  }
}

export async function saveSermon(sermon: Sermon): Promise<void> {
  const key = sermon.id || `sermon_${sermon.date}_${Date.now()}`;
  const { id: _id, ...rest } = sermon;
  await apiFetch(`/config/${key}`, {
    method: 'PUT',
    json: { value: JSON.stringify(rest) },
  });
}

export async function deleteSermon(id: string): Promise<void> {
  await apiFetch(`/config/${id}`, { method: 'DELETE' });
}

// ── Member type (utilisé par planning gestion) ────────────────────────────────

export interface Member {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email?: string;
  phone?: string;
  instrument?: string;
  is_active?: boolean;
}

// ── Planning Gestion (module partagé PsalmMembre ↔ PsalmAdmin) ───────────────

export interface SundayPerson {
  user_id: string;
  pole: string;
  first_name: string;
  last_name: string;
  confirmed?: string | null;
}

export interface Sunday {
  id: string;
  date: string;
  label?: string;
  title?: string;
  dirigeant?: string;
  dir_first?: string;
  dir_last?: string;
  dirigeant_id?: string | null;
  dir_id?: string | null;
  note?: string | null;
  is_jeunesse?: boolean;
  is_locked?: boolean;
  assignments?: Record<string, SundayPerson[]>;
}

export interface AbsenceWithMember {
  id: string;
  date_start: string;
  date_end: string;
  reason?: string;
  created_at?: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

export const getFullPlanning = async (year?: number): Promise<Sunday[]> => {
  const y = year ?? new Date().getFullYear();
  const data = await apiFetch<any[]>(`/planning/${y}`);

  return (data || []).map((s: any) => {
    const assignments: Record<string, SundayPerson[]> = {};
    for (const a of s.assignments || s.sunday_assignments || []) {
      if (!assignments[a.pole]) assignments[a.pole] = [];
      assignments[a.pole].push({
        user_id: a.user_id,
        pole: a.pole,
        first_name: a.first_name || a.profiles?.first_name || '',
        last_name: a.last_name || a.profiles?.last_name || '',
        confirmed: a.confirmed === null ? null : a.confirmed ? '1' : '0',
      });
    }
    return {
      id: String(s.id),
      date: s.date,
      label: s.label,
      is_jeunesse: s.is_jeunesse,
      dirigeant_id: s.dirigeant_id,
      dir_id: s.dirigeant_id,
      dir_first: s.dir_first || '',
      dir_last: s.dir_last || '',
      dirigeant: s.dirigeant,
      note: s.note,
      is_locked: s.is_locked,
      assignments,
    };
  });
};

export const getMembersForPlanning = () => getMembers();

// Guard anti-double-clic
const _savingIds = new Set<string>();

export async function assignSunday(
  sundayId: string,
  data: {
    dirigeant_id?: string | null;
    note?: string | null;
    poles: Record<string, string[]>;
  }
): Promise<void> {
  if (_savingIds.has(sundayId)) return;
  _savingIds.add(sundayId);
  try {
    await apiFetch(`/planning/sunday/${sundayId}/assign`, {
      method: 'PUT',
      json: {
        dirigeant_id: data.dirigeant_id || null,
        note: data.note || null,
        poles: data.poles,
      },
    });
  } finally {
    _savingIds.delete(sundayId);
  }
}

export const getAllAbsences = async (): Promise<AbsenceWithMember[]> => {
  const data = await apiFetch<any[]>('/absences');
  return (data || []).map((a: any) => ({
    id: String(a.id),
    date_start: a.date_start,
    date_end: a.date_end,
    reason: a.reason,
    created_at: a.created_at,
    user_id: a.user_id,
    first_name: a.first_name || '',
    last_name: a.last_name || '',
  }));
};

export function getAbsentMemberIds(absences: AbsenceWithMember[], date: string): Set<string> {
  return new Set(
    absences
      .filter(a => a.date_start <= date && a.date_end >= date)
      .map(a => String(a.user_id))
  );
}

// ── Admin / Migrations (dev only) ─────────────────────────────────────────────

export interface MigrationEntry {
  hash: string;
  applied_at: string | null;
}

export interface MigrationsStatus {
  migrations: MigrationEntry[];
}

export interface MigrationsRunResult {
  ok: boolean;
  applied: number;
  new_migrations: string[];
  total: number;
  message: string;
}

export async function getMigrationsStatus(): Promise<MigrationsStatus> {
  return apiFetch<MigrationsStatus>('/admin/migrations/status');
}

export async function runMigrations(): Promise<MigrationsRunResult> {
  return apiFetch<MigrationsRunResult>('/admin/migrations/run', { method: 'POST' });
}
