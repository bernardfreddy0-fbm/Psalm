import { supabase, supabaseAdmin } from './supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function throwIfError<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('Aucune donnée');
  return data;
}

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

// ── Auth ──────────────────────────────────────────────────────────────────────

export function setToken(_token: string) { /* géré par Supabase */ }
export function clearToken() { supabase.auth.signOut(); }

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, role, phone')
    .eq('id', data.user.id)
    .single();

  return profile;
}

export async function checkAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, phone')
      .eq('id', session.user.id)
      .single();
    return profile;
  } catch {
    return null;
  }
}

export async function logout() {
  await supabase.auth.signOut();
}

// ── Members ───────────────────────────────────────────────────────────────────

export const getMembers = () =>
  supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, role, is_active, instrument, is_experienced, avatar_color')
    .order('last_name')
    .then(({ data, error }) => {
      throwIfError(data, error);
      return (data || []).filter(isActiveMember).map(normalizeMember);
    });

export const createMember = async (data: { first_name: string; last_name: string; email: string; role: string; phone?: string; instrument?: string }) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const res = await fetch('/api/create-member', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erreur création membre');
  return json.data;
};

export const updateMember = async (id: string, data: Record<string, any>) => {
  const payload: any = { ...data, updated_at: new Date().toISOString() };
  if (data.is_active !== undefined) payload.is_active = data.is_active !== '0' && data.is_active !== false;
  const { error } = await supabaseAdmin.from('profiles').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
  return { success: true };
};

export const deleteMember = async (id: string) => {
  const { error } = await supabaseAdmin.from('profiles').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
};

export const resetMemberPassword = async (userId: string, newPassword: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const res = await fetch('/api/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ user_id: userId, new_password: newPassword }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erreur reset mot de passe');
  return json;
};

// ── Planning / Sundays ───────────────────────────────────────────────────────

export const getPlanning = async (year: number) => {
  const { data, error } = await supabase
    .from('sundays')
    .select(`
      id, date, label, is_jeunesse, dirigeant_id, dirigeant, note, pastor_note,
      is_approved, is_locked, choristes, piano, batterie, guitare_elec,
      guitare_acou, basse, son, projection, video, theme, start_time,
      sunday_assignments(
        user_id, pole, confirmed, instrument,
        profiles(first_name, last_name, role)
      )
    `)
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`)
    .order('date');
  throwIfError(data, error);

  return (data || []).map((s: any) => ({
    ...s,
    id: String(s.id),
    assignments: s.sunday_assignments || [],
  }));
};

export const createSunday = async (date: string, label: string) => {
  const { data, error } = await supabase
    .from('sundays')
    .insert({ date, label, updated_at: new Date().toISOString() })
    .select('id')
    .single();
  throwIfError(data, error);
  return data;
};

export const updateSunday = async (id: string, data: Record<string, any>) => {
  const { error } = await supabase
    .from('sundays')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', Number(id));
  if (error) throw new Error(error.message);
  return { success: true };
};

export const deleteSunday = async (id: string) => {
  const { error } = await supabaseAdmin.from('sundays').delete().eq('id', Number(id));
  if (error) throw new Error(error.message);
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
  const { data, error } = await supabase
    .from('songs')
    .select('id, title, author, key_note, tempo, tags, youtube_url, lyrics, partition_url, audio_url, folder')
    .order('title');
  throwIfError(data, error);
  return (data || []).map((s: any) => ({
    ...s,
    id: String(s.id),
    key: s.key_note,
    link: s.youtube_url,
  }));
};

export const getSongFolders = async (): Promise<string[]> => {
  const { data } = await supabaseAdmin.from('songs').select('folder').not('folder', 'is', null);
  return [...new Set((data || []).map((s: any) => s.folder).filter(Boolean))];
};

export const createSong = async (data: { title: string; author?: string; key?: string; tempo?: string; tags?: string }) => {
  const { error } = await supabaseAdmin.from('songs').insert({
    title: data.title,
    author: data.author || null,
    key_note: data.key || null,
    tempo: data.tempo || null,
    tags: data.tags || null,
  });
  if (error) throw new Error(error.message);
};

export const updateSong = async (id: string, data: Record<string, any>) => {
  const payload: any = { ...data };
  if (data.key !== undefined) { payload.key_note = data.key; delete payload.key; }
  if (data.link !== undefined) { payload.youtube_url = data.link; delete payload.link; }
  const { error } = await supabaseAdmin.from('songs').update(payload).eq('id', Number(id));
  if (error) throw new Error(error.message);
};

export const deleteSong = async (id: string) => {
  const { error } = await supabaseAdmin.from('songs').delete().eq('id', Number(id));
  if (error) throw new Error(error.message);
};

export const uploadPartition = async (songId: string, file: File): Promise<{ partition_url: string }> => {
  const path = `partitions/${songId}/${file.name}`;
  const { error } = await supabaseAdmin.storage.from('songs').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data: url } = supabaseAdmin.storage.from('songs').getPublicUrl(path);
  await supabaseAdmin.from('songs').update({ partition_url: url.publicUrl }).eq('id', Number(songId));
  return { partition_url: url.publicUrl };
};

export const deletePartition = async (songId: string) => {
  const { error } = await supabaseAdmin.from('songs').update({ partition_url: null }).eq('id', Number(songId));
  if (error) throw new Error(error.message);
};

// ── Permissions ───────────────────────────────────────────────────────────────

export const getPermissions = async (): Promise<{ permissions: Record<string, string[]> }> => {
  const { data, error } = await supabase
    .from('permissions')
    .select('permission_key, roles')
    .eq('active', true);
  throwIfError(data, error);
  const permissions: Record<string, string[]> = {};
  for (const row of data!) permissions[row.permission_key] = row.roles as string[];
  return { permissions };
};

export async function savePermissions(matrix: Record<string, string[]>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non connecté');

  const rows = Object.entries(matrix).map(([permission_key, roles]) => ({
    permission_key,
    roles,
    active: true,
    updated_by: session.user.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('permissions')
    .upsert(rows, { onConflict: 'permission_key' });
  if (error) throw new Error(error.message);
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
  const { data, error } = await supabaseAdmin.from('events').select('*').order('date');
  throwIfError(data, error);
  return (data || []).map((e: any) => ({
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
  const { error } = await supabaseAdmin.from('events').insert({
    title: data.title,
    date: data.date_start,
    end_date: data.date_end || null,
    type: data.type || null,
    description: data.description || null,
    location: data.location || null,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function updateSpecialEvent(id: string, data: Partial<SpecialEvent>) {
  const { error } = await supabaseAdmin.from('events').update({
    title: data.title,
    date: data.date_start,
    end_date: data.date_end || null,
    type: data.type || null,
    description: data.description || null,
    location: data.location || null,
  }).eq('id', Number(id));
  if (error) throw new Error(error.message);
  return { success: true };
}

export const deleteSpecialEvent = async (id: string) => {
  const { error } = await supabaseAdmin.from('events').delete().eq('id', Number(id));
  if (error) throw new Error(error.message);
};

// ── Config / Settings ─────────────────────────────────────────────────────────

export async function getSettingsByCategory(category: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('config')
    .select('key, value')
    .like('key', `${category}_%`);
  throwIfError(data, error);
  return (data || []).map(r => ({ key_name: r.key.replace(`${category}_`, ''), value: r.value }));
}

export async function getAllSettings(): Promise<Record<string, any[]>> {
  const { data } = await supabaseAdmin.from('config').select('key, value');
  const result: Record<string, any[]> = {};
  for (const row of data || []) {
    const [cat, ...rest] = row.key.split('_');
    if (!result[cat]) result[cat] = [];
    result[cat].push({ key_name: rest.join('_'), value: row.value });
  }
  return result;
}

export async function saveSetting(category: string, key: string, value: any) {
  const fullKey = `${category}_${key}`;
  const { error } = await supabaseAdmin.from('config').upsert(
    { key: fullKey, value: typeof value === 'string' ? value : JSON.stringify(value), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function saveSettingsBulk(settings: { category: string; key: string; value: any }[]) {
  const rows = settings.map(s => ({
    key: `${s.category}_${s.key}`,
    value: typeof s.value === 'string' ? s.value : JSON.stringify(s.value),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from('config').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin.from('config').select('key, value');
  throwIfError(data, error);
  return Object.fromEntries((data || []).map(r => [r.key, r.value]));
}

export async function saveSettings(settings: { key: string; value: string }[]) {
  const rows = settings.map(s => ({ key: s.key, value: s.value, updated_at: new Date().toISOString() }));
  const { error } = await supabaseAdmin.from('config').upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getSystemStats() {
  const [members, songs, sundays] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('songs').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('sundays').select('id', { count: 'exact', head: true }),
  ]);
  return { members: members.count, songs: songs.count, sundays: sundays.count };
}

export async function clearCache() { return { success: true }; }
export function getBackupUrl(): string { return ''; }

// ── Programme du culte ────────────────────────────────────────────────────────

export async function saveProgram(date: string, data: object) {
  const { error } = await supabaseAdmin.from('config').upsert(
    { key: `programme_${date}`, value: JSON.stringify(data), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function loadPrograms(): Promise<Array<{ key_name: string; value: string }>> {
  const { data } = await supabaseAdmin.from('config').select('key, value').like('key', 'programme_%');
  return (data || []).map(r => ({ key_name: r.key.replace('programme_', ''), value: r.value }));
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
  const { data, error } = await supabase
    .from('sunday_runsheet')
    .select('*')
    .eq('sunday_id', Number(sundayId))
    .order('position');
  throwIfError(data, error);
  const { data: sunday } = await supabaseAdmin.from('sundays').select('start_time').eq('id', Number(sundayId)).single();
  return {
    items: (data || []).map((r: any) => ({ ...r, id: String(r.id), song_id: r.song_id ? String(r.song_id) : null })),
    start_time: sunday?.start_time || '10:00',
  };
}

export async function saveRunsheet(sundayId: string, items: RunsheetItem[]): Promise<void> {
  await supabaseAdmin.from('sunday_runsheet').delete().eq('sunday_id', Number(sundayId));
  if (items.length === 0) return;
  const { error } = await supabaseAdmin.from('sunday_runsheet').insert(
    items.map((item, i) => ({
      sunday_id: Number(sundayId),
      position: item.position ?? i,
      type: item.type,
      title: item.title,
      duration_min: item.duration_min,
      notes: item.notes || null,
      song_id: item.song_id ? Number(item.song_id) : null,
      is_published: item.is_published ?? false,
    }))
  );
  if (error) throw new Error(error.message);
}

export async function publishRunsheet(sundayId: string, published: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from('sunday_runsheet').update({ is_published: published }).eq('sunday_id', Number(sundayId));
  if (error) throw new Error(error.message);
}

export async function updateRunsheetStartTime(sundayId: string, startTime: string): Promise<void> {
  const { error } = await supabaseAdmin.from('sundays').update({ start_time: startTime }).eq('id', Number(sundayId));
  if (error) throw new Error(error.message);
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
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString();
  const logs: ActivityLog[] = [];

  const [absencesRes, disposRes, profilesRes, sundaysRes, songsRes] = await Promise.allSettled([
    supabase
      .from('absences')
      .select('id, user_id, sunday_date, created_at, profiles(first_name, last_name)')
      .gte('created_at', cutoffStr)
      .order('created_at', { ascending: false })
      .limit(40),

    supabase
      .from('disponibilites')
      .select('id, user_id, date, status, updated_at, profiles(first_name, last_name)')
      .gte('updated_at', cutoffStr)
      .order('updated_at', { ascending: false })
      .limit(40),

    supabase
      .from('profiles')
      .select('id, first_name, last_name, role, created_at')
      .gte('created_at', cutoffStr)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('sundays')
      .select('id, date, label, updated_at')
      .gte('updated_at', cutoffStr)
      .order('updated_at', { ascending: false })
      .limit(20),

    supabase
      .from('songs')
      .select('id, title, author, created_at')
      .gte('created_at', cutoffStr)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  if (absencesRes.status === 'fulfilled' && absencesRes.value.data) {
    for (const a of absencesRes.value.data) {
      const profile = a.profiles as any;
      const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Membre';
      const dateStr = a.sunday_date
        ? new Date(a.sunday_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : undefined;
      logs.push({
        id: `abs_${a.id}`,
        type: 'absence',
        action: 'absence_declared',
        description: `${name} a déclaré une absence`,
        user_name: name,
        detail: dateStr,
        created_at: a.created_at,
      });
    }
  }

  if (disposRes.status === 'fulfilled' && disposRes.value.data) {
    for (const d of disposRes.value.data) {
      const profile = d.profiles as any;
      const name = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Membre';
      const statusLabel =
        d.status === 'available' ? 'disponible' :
        d.status === 'unavailable' ? 'indisponible' : 'incertain';
      const dateStr = d.date
        ? new Date(d.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : undefined;
      logs.push({
        id: `dispo_${d.id}`,
        type: 'dispo',
        action: 'dispo_updated',
        description: `${name} s'est marqué ${statusLabel}`,
        user_name: name,
        detail: dateStr,
        created_at: d.updated_at,
      });
    }
  }

  if (profilesRes.status === 'fulfilled' && profilesRes.value.data) {
    for (const p of profilesRes.value.data) {
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
      if (!name) continue;
      logs.push({
        id: `profile_${p.id}`,
        type: 'member',
        action: 'member_created',
        description: `Nouveau membre : ${name}`,
        user_name: name,
        detail: p.role ? p.role.split(',')[0].replace(/_/g, ' ') : 'Membre',
        created_at: p.created_at,
      });
    }
  }

  if (sundaysRes.status === 'fulfilled' && sundaysRes.value.data) {
    for (const s of sundaysRes.value.data) {
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
        created_at: s.updated_at,
      });
    }
  }

  if (songsRes.status === 'fulfilled' && songsRes.value.data) {
    for (const s of songsRes.value.data) {
      logs.push({
        id: `song_${s.id}`,
        type: 'song',
        action: 'song_created',
        description: `Nouveau chant : ${s.title}`,
        user_name: s.author || 'Inconnu',
        detail: s.author || undefined,
        created_at: s.created_at,
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
  const cutoffStr = cutoff.toISOString();

  const [absences, dispos, members, songs] = await Promise.allSettled([
    supabaseAdmin.from('absences').select('id', { count: 'exact', head: true }).gte('created_at', cutoffStr),
    supabaseAdmin.from('disponibilites').select('id', { count: 'exact', head: true }).gte('updated_at', cutoffStr),
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', cutoffStr),
    supabaseAdmin.from('songs').select('id', { count: 'exact', head: true }).gte('created_at', cutoffStr),
  ]);

  return {
    absences: absences.status === 'fulfilled' ? absences.value.count ?? 0 : 0,
    dispos:   dispos.status === 'fulfilled'   ? dispos.value.count   ?? 0 : 0,
    members:  members.status === 'fulfilled'  ? members.value.count  ?? 0 : 0,
    songs:    songs.status === 'fulfilled'    ? songs.value.count    ?? 0 : 0,
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
  const { data: sundays, error } = await supabaseAdmin
    .from('sundays')
    .select('id, date, label, is_jeunesse, dispo_deadline')
    .gte('date', `${y}-01-01`)
    .lte('date', `${y}-12-31`)
    .order('date');
  if (error) throw new Error(error.message);

  const { data: dispos } = await supabaseAdmin
    .from('disponibilites')
    .select('sunday_id, user_id, available, note, responded_at, profiles(first_name, last_name, role)')
    .in('sunday_id', (sundays || []).map((s: any) => s.id));

  const { data: members } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: false })
    .eq('is_active', true)
    .not('first_name', 'eq', '[Supprimé]');
  const totalMembers = members?.length ?? 0;

  const dispoMap = new Map<number, DispoEntry[]>();
  for (const d of dispos || []) {
    const p = d.profiles as any;
    const entry: DispoEntry = {
      user_id: d.user_id,
      first_name: p?.first_name || '',
      last_name: p?.last_name || '',
      role: p?.role || '',
      available: d.available,
      note: d.note,
      responded_at: d.responded_at,
    };
    if (!dispoMap.has(d.sunday_id)) dispoMap.set(d.sunday_id, []);
    dispoMap.get(d.sunday_id)!.push(entry);
  }

  return (sundays || []).map((s: any) => {
    const responses = dispoMap.get(s.id) || [];
    return {
      sunday_id: String(s.id),
      date: s.date,
      label: s.label,
      is_jeunesse: s.is_jeunesse,
      dispo_deadline: s.dispo_deadline,
      responses,
      total_members: totalMembers,
      responded_count: responses.length,
      available_count: responses.filter(r => r.available === true).length,
    };
  });
}

export async function setDispoDeadline(sundayId: string, deadline: string | null): Promise<void> {
  const { error } = await supabaseAdmin
    .from('sundays')
    .update({ dispo_deadline: deadline })
    .eq('id', Number(sundayId));
  if (error) throw new Error(error.message);
}

// ── Absences (vue admin) ──────────────────────────────────────────────────────

export interface AdminAbsence {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  sunday_date: string;
  reason: string | null;
  created_at: string;
}

export async function getAbsencesAdmin(year?: number): Promise<AdminAbsence[]> {
  const y = year ?? new Date().getFullYear();
  const { data, error } = await supabaseAdmin
    .from('absences')
    .select('id, user_id, sunday_date, reason, created_at, profiles(first_name, last_name, role)')
    .gte('sunday_date', `${y}-01-01`)
    .lte('sunday_date', `${y}-12-31`)
    .order('sunday_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((a: any) => ({
    id: String(a.id),
    user_id: a.user_id,
    first_name: a.profiles?.first_name || '',
    last_name: a.profiles?.last_name || '',
    role: a.profiles?.role || '',
    sunday_date: a.sunday_date,
    reason: a.reason || null,
    created_at: a.created_at,
  }));
}

export async function deleteAbsenceAdmin(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('absences').delete().eq('id', Number(id));
  if (error) throw new Error(error.message);
}

// ── Archives vidéo (video_meta) ───────────────────────────────────────────────

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
  const { data, error } = await supabaseAdmin
    .from('video_meta')
    .select('video_id, preacher, theme, tags, checklist, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    video_id: r.video_id,
    preacher: r.preacher ?? null,
    theme: r.theme ?? null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    checklist: r.checklist ?? { montage: false, subtitles: false, thumbnail: false, description_yt: false, published: false },
    updated_at: r.updated_at ?? null,
  }));
}

export async function deleteVideoMeta(videoId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('video_meta').delete().eq('video_id', videoId);
  if (error) throw new Error(error.message);
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
  const { data, error } = await supabaseAdmin
    .from('config')
    .select('key, value')
    .like('key', 'sermon_%')
    .order('key', { ascending: false });
  if (error) return [];
  return (data || []).map((r: any) => {
    try { return { id: r.key, ...JSON.parse(r.value) }; }
    catch { return null; }
  }).filter(Boolean) as Sermon[];
}

export async function saveSermon(sermon: Sermon): Promise<void> {
  const key = sermon.id || `sermon_${sermon.date}_${Date.now()}`;
  const { id: _id, ...rest } = sermon;
  const { error } = await supabaseAdmin
    .from('config')
    .upsert({ key, value: JSON.stringify(rest), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw new Error(error.message);
}

export async function deleteSermon(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('config').delete().eq('key', id);
  if (error) throw new Error(error.message);
}
