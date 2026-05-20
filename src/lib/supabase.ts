import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://thwgkwsuukcyxjevtzxb.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRod2drd3N1dWtjeXhqZXZ0enhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTk3NDUsImV4cCI6MjA5MzQ5NTc0NX0.gzfoEqwOfswg1C4O_GXXdouVKuDpMsJs9hGM-au9YkA';
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRod2drd3N1dWtjeXhqZXZ0enhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzkxOTc0NSwiZXhwIjoyMDkzNDk1NzQ1fQ.revRTFLg4dw_VswwuiQged4m50BVypE69D7-i2AS9j4';

// Client pour l'auth (anon key, respecte RLS côté session)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Client admin pour toutes les opérations DB du back office (bypass RLS)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, storageKey: 'sb-admin-bypass' },
});
