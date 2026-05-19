import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://thwgkwsuukcyxjevtzxb.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRod2drd3N1dWtjeXhqZXZ0enhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTk3NDUsImV4cCI6MjA5MzQ5NTc0NX0.gzfoEqwOfswg1C4O_GXXdouVKuDpMsJs9hGM-au9YkA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
