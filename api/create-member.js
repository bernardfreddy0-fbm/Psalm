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

  // Vérifier que l'appelant est authentifié et a le rôle requis
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

  // Créer l'utilisateur
  const { first_name, last_name, email, role, phone, instrument } = req.body;
  if (!first_name || !last_name || !email || !role) {
    return res.status(400).json({ error: 'Champs requis : first_name, last_name, email, role' });
  }

  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: 'AEF2026!',
    email_confirm: true,
    user_metadata: { first_name, last_name, role },
  });

  if (createErr) return res.status(400).json({ error: createErr.message });

  const { error: profileErr } = await supabase.from('profiles').insert({
    id: newUser.user.id,
    email,
    first_name,
    last_name,
    role,
    phone: phone || null,
    instrument: instrument || null,
    is_active: true,
  });

  if (profileErr) {
    // Rollback : supprimer l'utilisateur Auth créé
    await supabase.auth.admin.deleteUser(newUser.user.id);
    return res.status(500).json({ error: profileErr.message });
  }

  return res.status(200).json({
    success: true,
    data: { id: newUser.user.id, email, first_name, last_name, role },
  });
}
