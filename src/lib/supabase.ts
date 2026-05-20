import { createClient } from '@supabase/supabase-js';

/**
 * ⚠️ SÉCURITÉ — Clés Supabase
 *
 * - VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY : peuvent être publiques (conçues pour ça)
 * - VITE_SUPABASE_SERVICE_KEY : doit être définie UNIQUEMENT via variable d'environnement
 *   Coolify/CI — ne jamais committer cette valeur dans le code source.
 *   La sécurité repose sur les RLS Supabase + cette app étant une interface admin privée.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('[Config] Variables d\'environnement Supabase manquantes. Vérifiez VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_SERVICE_KEY dans Coolify.');
}

// Client pour l'auth (anon key, respecte RLS côté session)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Client admin pour toutes les opérations DB du back office (bypass RLS)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, storageKey: 'sb-admin-bypass' },
});
