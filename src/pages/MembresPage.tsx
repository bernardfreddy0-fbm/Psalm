import { useEffect, useState } from 'react';
import { getMembers, createMember, deleteMember } from '@/lib/api';
import { Users, Plus, Trash2, UserCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const ROLES = [
  'conducteur_louange', 'responsable_louange', 'responsable_technique',
  'pasteur', 'choriste', 'musicien', 'sonorisateur', 'projectionniste', 'videaste', 'dev'
];

const roleLabel = (r: string) => r?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Membre';

export default function MembresPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', role: 'choriste' });

  const load = () => {
    setLoading(true);
    getMembers().then(setMembers).catch(() => setMembers([])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMember(form);
    setForm({ first_name: '', last_name: '', email: '', role: 'choriste' });
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce membre ?')) return;
    await deleteMember(id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Membres</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          onSubmit={handleCreate}
          className="bg-card rounded-lg border border-border p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}
            placeholder="Prénom" className="px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground" required />
          <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })}
            placeholder="Nom" className="px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground" required />
          <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="Email" className="px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground" required />
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
            className="px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground">
            {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
          <div className="sm:col-span-2">
            <button type="submit" className="px-4 py-2 rounded-md bg-success text-success-foreground text-sm font-medium">Créer</button>
          </div>
        </motion.form>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement...</p>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Aucun membre</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card rounded-lg border border-border p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                    {m.first_name?.[0]}{m.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="mt-3">
                <span className="inline-block px-2 py-0.5 rounded-full bg-gold/10 text-gold text-xs font-medium">
                  {roleLabel(m.role)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
