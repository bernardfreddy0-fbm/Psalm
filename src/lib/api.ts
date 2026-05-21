import { request, requestFormData } from './apiClient';
import { generateSecurePassword } from './security';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEGACY_ROLE_ALIASES: Record<string, string> = {
  responsable_louange: 'conducteur_louange',
};

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

function parseRoles(roles: string | null | undefined): string[] {
  if (!roles) return [];
  const s = roles.trim();
  if (s.startsWith('{') && s.endsWith('}')) {
    return s.slice(1, -1).split(',').filter(Boolean).map(r => r.trim().replace(/^"(.*)"$/, '$1'));
  }
  if (s.startsWith('[')) {
    try { return JSON.parse(s); } catch {}
  }
  return s.split(',').filter(Boolean).map(r => r.trim());
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function setToken(_token: string) { /* géré par apiClient */ }
export function clearToken() {
  const rt = localStorage.getItem('aef_refresh_token');
  if (rt) request('POST', '/auth/logout', { refresh_token: rt }).catch(() => {});
  localStorage.removeItem('aef_token');
  localStorage.removeItem('aef_refresh_token');
}

function translateHonoError(msg: string): string {
  const map: Record<string, string> = {
    'Identifiants incorrects': 'Identifiants incorrects',
    'Compte désactivé': 'Compte désactivé — contactez un administrateur',
    'Compte non migré': 'Compte non migré — contactez l\'admin',
    'Email et mot de passe requis': 'Email et mot de passe requis',
    'Session expirée': 'Session expirée — veuillez vous reconnecter',
  };
  for (const [key, fr] of Object.entries(map)) {
    if (msg.includes(key)) return fr;
  }
  return msg;
}

export async function login(email: string, password: string) {
  try {
    const data = await request<{
      access_token: string;
      refresh_token: string;
      user: { id: string; first_name: string; last_name: string; email: string; role: string | null };
    }>('POST', '/auth/login', { email, password });

    localStorage.setItem('aef_token', data.access_token);
    localStorage.setItem('aef_refresh_token', data.refresh_token);

    return {
      ...data.user,
      role: normalizeRoleCsv(data.user.role),
    };
  } catch (e: any) {
    const raw = e?.message ?? '';
    let msg = raw;
    try { msg = JSON.parse(raw)?.error ?? raw; } catch {}
    throw new Error(translateHonoError(msg));
  }
}

export async function checkAuth() {
  const token = localStorage.getItem('aef_token');
  if (!token) return null;
  try {
    const profile = await request<any>('GET', '/auth/me');
    return profile ? normalizeMember(profile) : null;
  } catch {
    return null;
  }
}

export async function logout() {
  const rt = localStorage.getItem('aef_refresh_token');
  try {
    if (rt) await request('POST', '/auth/logout', { refresh_token: rt });
  } catch {}
  localStorage.removeItem('aef_token');
  localStorage.removeItem('aef_refresh_token');
}

// ── Members ───────────────────────────────────────────────────────────────────

export const getMembers = async () => {
  const data = await request<any[]>('GET', '/members');
  return data.filter(isActiveMember).map(normalizeMember);
};

export const getAllAccounts = async () => {
  const data = await request<any[]>('GET', '/members');
  return data.filter(m => m.first_name !== '[Supprimé]').map(normalizeMember);
};

export const createMember = async (data: {
  first_name: string; last_name: string; email: string;
  role: string; phone?: string; instrument?: string; password?: string;
}) => {
  const passwordUsed = data.password ?? generateSecurePassword(16);
  const result = await request<{ id: string; password: string }>('POST', '/members', {
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    role: data.role,
    phone: data.phone || null,
    instrument: data.instrument || null,
    password: passwordUsed,
  });
  return { id: result.id, password: result.password ?? passwordUsed };
};

export const updateMember = async (id: string, data: Record<string, any>) => {
  const payload: any = { ...data };
  if (data.is_active !== undefined) payload.is_active = data.is_active !== '0' && data.is_active !== false;
  await request('PUT', `/members/${id}`, payload);
  return { success: true };
};

export const updateMemberEmail = async (userId: string, newEmail: string) => {
  await request('PUT', `/members/${userId}/email`, { email: newEmail });
  return { success: true };
};

export const deleteMember = async (id: string) => {
  await request('DELETE', `/members/${id}`);
};

export const resetMemberPassword = async (userId: string, newPassword: string) => {
  await request('POST', `/members/${userId}/reset-password`, { password: newPassword });
  return { success: true };
};

export async function logSecurityEvent(event: string, meta?: Record<string, any>) {
  console.warn('[SECURITY AUDIT]', event, meta);
}

// ── Planning / Sundays ───────────────────────────────────────────────────────

export const getPlanning = async (year: number) => {
  const data = await request<any[]>('GET', `/planning/${year}`);
  return data.map((s: any) => ({
    ...s,
    id: String(s.id),
    assignments: s.assignments || [],
  }));
};

export const createSunday = async (date: string, label: string) => {
  return request<{ id: string }>('POST', '/planning/sunday', { date, label });
};

export const updateSunday = async (id: string, data: Record<string, any>) => {
  await request('PUT', `/planning/sunday/${id}`, data);
  return { success: true };
};

export const deleteSunday = async (id: string) => {
  await request('DELETE', `/planning/sunday/${id}`);
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
  const data = await request<any[]>('GET', '/songs');
  return data.map((s: any) => ({
    ...s,
    id: String(s.id),
    key: s.key_note,
    link: s.youtube_url,
  }));
};

export const getSongFolders = async (): Promise<string[]> => {
  const data = await request<any[]>('GET', '/songs');
  return [...new Set(data.map((s: any) => s.folder).filter(Boolean))];
};

export const createSong = async (data: {
  title: string; author?: string; key?: string; tempo?: string; tags?: string;
}) => {
  await request('POST', '/songs', {
    title: data.title,
    author: data.author || null,
    key_note: data.key || null,
    tempo: data.tempo || null,
    tags: data.tags || null,
  });
};

export const updateSong = async (id: string, data: Record<string, any>) => {
  const payload: any = { ...data };
  if (data.key !== undefined) { payload.key_note = data.key; delete payload.key; }
  if (data.link !== undefined) { payload.youtube_url = data.link; delete payload.link; }
  await request('PUT', `/songs/${id}`, payload);
};

export const deleteSong = async (id: string) => {
  await request('DELETE', `/songs/${id}`);
};

export const uploadPartition = async (songId: string, file: File): Promise<{ partition_url: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  const result = await requestFormData<{ url: string }>('POST', `/songs/${songId}/partition`, formData);
  return { partition_url: result.url };
};

export const deletePartition = async (songId: string) => {
  await request('DELETE', `/songs/${songId}/partition`);
};

// ── Permissions ───────────────────────────────────────────────────────────────

export const getPermissions = async (): Promise<{ permissions: Record<string, string[]> }> => {
  const data = await request<{ permission_key: string; roles: string }[]>('GET', '/permissions');
  const permissions: Record<string, string[]> = {};
  for (const row of data) {
    permissions[row.permission_key] = parseRoles(row.roles);
  }
  return { permissions };
};

export async function savePermissions(matrix: Record<string, string[]>) {
  const token = localStorage.getItem('aef_token');
  if (!token) throw new Error('Non connecté');
  const body: Record<string, string> = {};
  for (const [key, roles] of Object.entries(matrix)) {
    body[key] = roles.join(',');
  }
  await request('PUT', '/permissions', body);
  return { success: true };
}

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
  const data = await request<any[]>('GET', '/events');
  return data.map((e: any) => ({
    id: String(e.id),
    title: e.title,
    date_start: e.date,
    date_end: e.end_date || undefined,
    type: (e.type as SpecialEvent['type']) || 'special',
    description: e.description || undefined,
    location: e.location || undefined,
  }));
};

export async function createSpecialEvent(data: Omit<SpecialEvent, 'id'>) {
  await request('POST', '/events', {
    date: data.date_start,
    title: data.title,
    end_date: data.date_end || null,
    type: data.type || null,
    description: data.description || null,
    location: data.location || null,
  });
  return { success: true };
}

export async function updateSpecialEvent(id: string, data: Partial<SpecialEvent>) {
  await request('PUT', `/events/${id}`, {
    date: data.date_start,
    title: data.title,
    end_date: data.date_end || null,
    type: data.type || null,
    description: data.description || null,
    location: data.location || null,
  });
  return { success: true };
}

export const deleteSpecialEvent = async (id: string) => {
  await request('DELETE', `/events/${id}`);
};

// ── Config / Settings ─────────────────────────────────────────────────────────

export async function getSettings(): Promise<Record<string, string>> {
  return request<Record<string, string>>('GET', '/config');
}

export async function saveSettings(settings: { key: string; value: string }[]) {
  const body: Record<string, string> = {};
  for (const s of settings) body[s.key] = s.value;
  await request('PUT', '/config', body);
  return { success: true };
}

export async function getSettingsByCategory(category: string): Promise<any[]> {
  const all = await request<Record<string, string>>('GET', '/config');
  const prefix = `${category}_`;
  return Object.entries(all)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, value]) => ({ key_name: key.replace(prefix, ''), value }));
}

export async function getAllSettings(): Promise<Record<string, any[]>> {
  const all = await request<Record<string, string>>('GET', '/config');
  const result: Record<string, any[]> = {};
  for (const [key, value] of Object.entries(all)) {
    const [cat, ...rest] = key.split('_');
    if (!result[cat]) result[cat] = [];
    result[cat].push({ key_name: rest.join('_'), value });
  }
  return result;
}

export async function saveSetting(category: string, key: string, value: any) {
  const fullKey = `${category}_${key}`;
  const strVal = typeof value === 'string' ? value : JSON.stringify(value);
  await request('PUT', `/config/${fullKey}`, { value: strVal });
  return { success: true };
}

export async function saveSettingsBulk(settings: { category: string; key: string; value: any }[]) {
  const body: Record<string, string> = {};
  for (const s of settings) {
    body[`${s.category}_${s.key}`] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
  }
  await request('PUT', '/config', body);
  return { success: true };
}

export async function getSystemStats() {
  const [members, songs, planning] = await Promise.all([
    request<any[]>('GET', '/members'),
    request<any[]>('GET', '/songs'),
    request<any[]>('GET', `/planning/${new Date().getFullYear()}`),
  ]);
  return {
    members: members.filter(isActiveMember).length,
    songs: songs.length,
    sundays: planning.length,
  };
}

export async function clearCache() { return { success: true }; }
export function getBackupUrl(): string { return ''; }

// ── Programme du culte ────────────────────────────────────────────────────────

export async function saveProgram(date: string, data: object) {
  await request('PUT', `/config/programme_${date}`, { value: JSON.stringify(data) });
  return { success: true };
}

export async function loadPrograms(): Promise<Array<{ key_name: string; value: string }>> {
  const all = await request<Record<string, string>>('GET', '/config');
  return Object.entries(all)
    .filter(([key]) => key.startsWith('programme_'))
    .map(([key, value]) => ({ key_name: key.replace('programme_', ''), value }));
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
  const data = await request<{ items: any[]; start_time: string }>('GET', `/runsheet/${sundayId}`);
  return {
    items: (data.items || []).map((r: any) => ({
      ...r,
      id: String(r.id),
      song_id: r.song_id ? String(r.song_id) : null,
    })),
    start_time: data.start_time || '10:00',
  };
}

export async function saveRunsheet(sundayId: string, items: RunsheetItem[]): Promise<void> {
  await request('POST', `/runsheet/${sundayId}`, {
    items: items.map((item, i) => ({
      position: item.position ?? i,
      type: item.type,
      title: item.title,
      duration_min: item.duration_min,
      notes: item.notes || null,
      song_id: item.song_id || null,
      is_published: item.is_published ?? false,
    })),
  });
}

export async function publishRunsheet(sundayId: string, published: boolean): Promise<void> {
  await request('PATCH', `/runsheet/${sundayId}/publish`, { published });
}

export async function updateRunsheetStartTime(sundayId: string, startTime: string): Promise<void> {
  await request('PUT', `/planning/sunday/${sundayId}`, { start_time: startTime });
}

// ── Activity logs ─────────────────────────────────────────────────────────────

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
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.type) qs.set('type', params.type);
  return request('GET', `/activity/logs${qs.size ? `?${qs}` : ''}`);
}

export async function getActivitySummary(days = 7): Promise<Record<string, number>> {
  return request('GET', `/activity/summary?days=${days}`);
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

export interface SundayDispo {
  sunday_id: string;
  date: string;
  label: string;
  is_jeunesse: boolean;
  dispo_deadline: string | null;
  responses: DispoEntry[];
  total_members: number;
  responded_count: number;
  available_count: number;
}

export async function getDisponibilitesAdmin(year?: number): Promise<SundayDispo[]> {
  const y = year ?? new Date().getFullYear();
  return request('GET', `/disponibilites/admin?year=${y}`);
}

export async function setDispoDeadline(sundayId: string, deadline: string | null): Promise<void> {
  await request('PUT', `/planning/sunday/${sundayId}`, { dispo_deadline: deadline });
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
  const data = await request<any[]>('GET', `/absences?year=${y}`);
  return data.map((a: any) => ({
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
  await request('DELETE', `/absences/${id}`);
}

// ── Archives vidéo (non migré — stub) ─────────────────────────────────────────

export interface VideoMetaSummary {
  video_id: string;
  preacher: string | null;
  theme: string | null;
  tags: string[];
  checklist: {
    montage: boolean;
    subtitles: boolean;
    thumbnail: boolean;
    description_yt: boolean;
    published: boolean;
  };
  updated_at: string | null;
}

export async function getVideoMetaList(): Promise<VideoMetaSummary[]> {
  return [];
}

export async function deleteVideoMeta(_videoId: string): Promise<void> {}

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
  const all = await request<Record<string, string>>('GET', '/config');
  return Object.entries(all)
    .filter(([key]) => key.startsWith('sermon_'))
    .map(([key, value]) => {
      try { return { id: key, ...JSON.parse(value) }; }
      catch { return null; }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.id.localeCompare(a.id)) as Sermon[];
}

export async function saveSermon(sermon: Sermon): Promise<void> {
  const key = sermon.id || `sermon_${sermon.date}_${Date.now()}`;
  const { id: _id, ...rest } = sermon;
  await request('PUT', `/config/${key}`, { value: JSON.stringify(rest) });
}

export async function deleteSermon(id: string): Promise<void> {
  await request('DELETE', `/config/${id}`);
}

// ── Member type ───────────────────────────────────────────────────────────────

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

// ── Planning Gestion ──────────────────────────────────────────────────────────

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
  const [planningData, membersData] = await Promise.all([
    request<any[]>('GET', year ? `/planning/${year}` : '/planning'),
    request<any[]>('GET', '/members'),
  ]);

  const memberMap = new Map<string, { first_name: string; last_name: string }>();
  for (const m of membersData) memberMap.set(m.id, m);

  return planningData.map((s: any) => {
    const assignments: Record<string, SundayPerson[]> = {};
    for (const a of s.assignments || []) {
      if (!assignments[a.pole]) assignments[a.pole] = [];
      assignments[a.pole].push({
        user_id: a.user_id,
        pole: a.pole,
        first_name: a.profiles?.first_name || '',
        last_name: a.profiles?.last_name || '',
        confirmed: a.confirmed ?? null,
      });
    }
    const dirMember = s.dirigeant_id ? memberMap.get(s.dirigeant_id) : null;
    return {
      id: String(s.id),
      date: s.date,
      label: s.label,
      is_jeunesse: s.is_jeunesse,
      dirigeant_id: s.dirigeant_id,
      dir_id: s.dirigeant_id,
      dir_first: dirMember?.first_name || '',
      dir_last: dirMember?.last_name || '',
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
    await request('PUT', `/planning/sunday/${sundayId}/assign`, data);
  } finally {
    _savingIds.delete(sundayId);
  }
}

export const getAllAbsences = async (): Promise<AbsenceWithMember[]> => {
  const data = await request<any[]>('GET', '/absences');
  return data.map((a: any) => ({
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
