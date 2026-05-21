import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL ?? 'https://thwgkwsuukcyxjevtzxb.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const allowed = ['dev', 'responsable_louange', 'pasteur'];
  const hasRole = profile?.role?.split(',').some(r => allowed.includes(r.trim()));
  if (!hasRole) return res.status(403).json({ error: 'Permission insuffisante' });

  const { user_id, new_password } = req.body;
  if (!user_id || !new_password) {
    return res.status(400).json({ error: 'Champs requis : user_id, new_password' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères min)' });
  }

  const { error } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });
  if (error) return res.status(400).json({ error: error.message });

  return res.status(200).json({ success: true });
}
