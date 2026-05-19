import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMembers } from '@/lib/api';
import { Users, Grid3X3, List, Search, Eye, X, Phone, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const POLES = ['Tous', 'Choriste & Dirigeant', 'Musique', 'Sonorisation', 'Projection', 'Vidéo'];
const AVATAR_COLORS = ['bg-accent', 'bg-success', 'bg-destructive', 'bg-warning', 'bg-gold', 'bg-info', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500'];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ROLE_LABELS: Record<string, string> = {
  dirigeant: 'Dirigeant',
  conducteur_louange: 'Dirigeant',
  choriste: 'Choriste',
  musicien: 'Musicien',
  pianiste: 'Pianiste',
  batteur: 'Batteur',
  guitariste_electrique: 'Guit. élec.',
  guitariste_acoustique: 'Guit. acou.',
  bassiste: 'Bassiste',
  sonorisateur: 'Sonorisateur',
  projectionniste: 'Projectionniste',
  videaste: 'Vidéaste',
  responsable_louange: 'Resp. Louange',
  responsable_technique: 'Resp. Technique',
  pasteur: 'Pasteur',
  dev: 'Dev',
};

const POLE_ROLES: Record<string, string[]> = {
  'Choriste & Dirigeant': ['choriste', 'dirigeant', 'conducteur_louange', 'responsable_louange'],
  'Musique': ['musicien', 'pianiste', 'batteur', 'guitariste_electrique', 'guitariste_acoustique', 'bassiste'],
  'Sonorisation': ['sonorisateur', 'responsable_technique'],
  'Projection': ['projectionniste'],
  'Vidéo': ['videaste'],
};

const CHORISTE_ROLES = ['choriste', 'dirigeant', 'conducteur_louange', 'responsable_louange'];
const MUSICIEN_ROLES = ['musicien', 'pianiste', 'batteur', 'guitariste_electrique', 'guitariste_acoustique', 'bassiste'];
const TECH_ROLES = ['sonorisateur', 'responsable_technique', 'projectionniste', 'videaste'];

function parseRoles(role: string): string[] {
  if (!role) return [];
  return role.split(',').map(r => r.trim()).filter(Boolean);
}

type SortOrder = 'A → Z' | 'Z → A' | 'Par rôle';
type ViewMember = { first_name: string; last_name: string; email: string; phone: string; roles: string[] } | null;

export default function MembresPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activePole, setActivePole] = useState('Tous');
  const [sortOrder, setSortOrder] = useState<SortOrder>('A → Z');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [viewing, setViewing] = useState<ViewMember>(null);

  useEffect(() => {
    getMembers().then(setMembers).catch(() => setMembers([])).finally(() => setLoading(false));
  }, []);

  const filtered = members.filter(m => {
    const roles = parseRoles(m.role);
    const matchSearch = `${m.first_name} ${m.last_name} ${roles.join(' ')}`.toLowerCase().includes(search.toLowerCase());
    const matchPole = activePole === 'Tous' || roles.some(r => (POLE_ROLES[activePole] || []).includes(r));
    return matchSearch && matchPole;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'A → Z') return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    if (sortOrder === 'Z → A') return `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`);
    // Par rôle : trier par premier rôle alphabétiquement (via label)
    const roleA = parseRoles(a.role)[0] || '';
    const roleB = parseRoles(b.role)[0] || '';
    return (ROLE_LABELS[roleA] || roleA).localeCompare(ROLE_LABELS[roleB] || roleB);
  });

  const countByPole = (roles: string[]) => (member: any) => parseRoles(member.role).some(r => roles.includes(r));
  const nbChoristes = members.filter(countByPole(CHORISTE_ROLES)).length;
  const nbMusiciens = members.filter(countByPole(MUSICIEN_ROLES)).length;
  const nbTech = members.filter(countByPole(TECH_ROLES)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">👥 Membres</h1>
      </div>

      {/* Stats */}
      <div className="bg-card rounded-lg border border-border p-4 mb-4 flex flex-wrap gap-6 items-start">
        <div><span className="text-2xl font-bold text-foreground">{loading ? '—' : members.length}</span><p className="text-xs text-muted-foreground">Total</p></div>
        <div className="border-l border-border pl-6"><span className="text-2xl font-bold text-foreground">{filtered.length}</span><p className="text-xs text-muted-foreground">Affichés</p></div>
        <div className="border-l border-border pl-6">
          <span className="text-2xl font-bold text-foreground">{new Set(members.flatMap(m => parseRoles(m.role))).size}</span>
          <p className="text-xs text-muted-foreground">Rôles distincts</p>
          {!loading && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {nbChoristes} Choristes · {nbMusiciens} Musiciens · {nbTech} Tech
            </p>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-card rounded-lg border border-border p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {POLES.map(p => (
            <button key={p} onClick={() => setActivePole(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activePole === p ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
              {p}
            </button>
          ))}
        </div>
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)}
          className="px-3 py-1.5 rounded-md border border-input bg-background text-xs">
          <option>A → Z</option>
          <option>Z → A</option>
          <option>Par rôle</option>
        </select>
        <div className="flex border border-border rounded-md overflow-hidden ml-auto">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 ${viewMode === 'grid' ? 'bg-muted' : 'bg-card'}`}><Grid3X3 className="w-4 h-4" /></button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 ${viewMode === 'list' ? 'bg-muted' : 'bg-card'}`}><List className="w-4 h-4" /></button>
        </div>
      </div>

      {/* View modal */}
      <AnimatePresence>
        {viewing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-card rounded-lg border border-border p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">Fiche membre</h3>
                <button onClick={() => setViewing(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-14 h-14 rounded-full ${getAvatarColor(viewing.first_name + viewing.last_name)} flex items-center justify-center text-sm font-bold text-card`}>
                  {viewing.first_name[0]}{viewing.last_name[0]}
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">{viewing.last_name}</p>
                  <p className="text-sm text-muted-foreground">{viewing.first_name}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {viewing.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    <a href={`mailto:${viewing.email}`} className="hover:text-accent underline underline-offset-2 break-all">{viewing.email}</a>
                  </div>
                )}
                {viewing.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <a href={`tel:${viewing.phone}`} className="hover:text-accent underline underline-offset-2">{viewing.phone}</a>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Fonctions</p>
                  <div className="flex flex-wrap gap-1">
                    {viewing.roles.map(r => (
                      <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{ROLE_LABELS[r] || r}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-border">
                <button
                  onClick={() => { setViewing(null); navigate('/comptes'); }}
                  className="w-full px-4 py-2 rounded-md border border-accent text-accent text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
                  Modifier
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Aucun membre</p></div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3' : 'space-y-2'}>
          {sorted.map((m, i) => {
            const initials = `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`;
            const color = getAvatarColor(`${m.first_name}${m.last_name}`);
            const roles = parseRoles(m.role);
            const openView = () => setViewing({ first_name: m.first_name, last_name: m.last_name, email: m.email || '', phone: m.phone || '', roles });

            if (viewMode === 'list') return (
              <motion.div key={m.id || `${m.first_name}-${m.last_name}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="bg-card rounded-lg border border-border p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30" onClick={openView}>
                <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-[11px] font-bold text-card`}>{initials}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-muted-foreground">{roles.map(r => ROLE_LABELS[r] || r).join(' · ')}</p>
                </div>
                <Eye className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            );

            return (
              <motion.div key={m.id || `${m.first_name}-${m.last_name}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="bg-card rounded-lg border border-border p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={openView}>
                <div className={`w-14 h-14 rounded-full ${color} flex items-center justify-center text-sm font-bold text-card mx-auto mb-2 ring-4 ring-card shadow-sm`}>{initials}</div>
                <p className="text-sm font-semibold text-foreground">{m.first_name} {m.last_name}</p>
                <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                  {roles.map(r => (
                    <span key={r} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{ROLE_LABELS[r] || r}</span>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
