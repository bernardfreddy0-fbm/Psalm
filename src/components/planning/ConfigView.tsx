import { useState } from 'react';
import { type MemberOption } from './planningTypes';
import {
  loadYouthDirectors,
  saveYouthDirectors,
  loadExperiencedDirigents,
  saveExperiencedDirigents,
  loadExperienced,
  saveExperienced,
  loadExperiencedMusicians,
  saveExperiencedMusicians,
} from './planningStorage';

// ── Config view ───────────────────────────────────────────────────────────────

export function ConfigView({ members }: { members: MemberOption[] }) {
  const parseRoles = (role: string) => role.split(',').map(r => r.trim());

  // Pools
  const youthSet     = loadYouthDirectors();
  const allDirigents = members.filter(m =>
    parseRoles(m.role).some(r => ['dirigeant','conducteur_louange','responsable_louange','pasteur'].includes(r))
  );
  // Section 1 : dirigeants hors jeunesse
  const nonYouthDirs = allDirigents.filter(m => !youthSet.has(`${m.first_name} ${m.last_name}`));
  // Section 4 : musiciens (piano, batterie, guitares, basse)
  const MUSICIAN_ROLES = ['pianiste','batteur','guitariste_electrique','guitariste_acoustique','bassiste'];
  const musiciens    = members.filter(m => parseRoles(m.role).some(r => MUSICIAN_ROLES.includes(r)));
  // Section 3 : choristes
  const choristes    = members.filter(m => parseRoles(m.role).includes('choriste'));

  const [expDirs,      setExpDirs]      = useState<Set<string>>(() => loadExperiencedDirigents());
  const [youthDirs,    setYouthDirs]    = useState<Set<string>>(() => loadYouthDirectors());
  const [expChor,      setExpChor]      = useState<Set<string>>(() => loadExperienced());
  const [expMusicians, setExpMusicians] = useState<Set<string>>(() => loadExperiencedMusicians());

  function toggle(
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    save: (s: Set<string>) => void,
    name: string
  ) {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      save(next);
      return next;
    });
  }

  function MemberRow({
    name, checked, color, onToggle, isExp,
  }: {
    name: string; checked: boolean; color: string; onToggle: () => void; isExp?: boolean;
  }) {
    return (
      <label className="flex items-center gap-2.5 cursor-pointer group">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 rounded accent-primary cursor-pointer"
        />
        <span className={`text-sm ${checked ? `${color} font-medium` : 'text-muted-foreground'}`}>
          {name}
        </span>
        {isExp && checked && <span className="text-yellow-400 text-xs">⭐</span>}
      </label>
    );
  }

  function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
    return (
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-[11px] text-muted-foreground mb-3">{description}</p>
        {children}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* 1. Dirigeants expérimentés (hors jeunesse) */}
      <Section
        title="⭐ Dirigeants expérimentés"
        description="Dirigeants prioritaires pour les dimanches normaux (hors jeunesse). Ils passent en tête dans l'algorithme."
      >
        {nonYouthDirs.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucun dirigeant hors jeunesse</p>
        ) : (
          <div className="space-y-1.5">
            {nonYouthDirs.map(m => {
              const name = `${m.first_name} ${m.last_name}`;
              return (
                <MemberRow
                  key={m.id}
                  name={name}
                  checked={expDirs.has(name)}
                  color="text-foreground"
                  isExp
                  onToggle={() => toggle(setExpDirs, saveExperiencedDirigents, name)}
                />
              );
            })}
          </div>
        )}
      </Section>

      {/* 2. Dirigeants jeunesse */}
      <Section
        title="👥 Dirigeants jeunesse"
        description="Ces dirigeants sont assignés le 2ème dimanche (culte jeunesse) et exclus les autres dimanches."
      >
        {allDirigents.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucun dirigeant trouvé</p>
        ) : (
          <div className="space-y-1.5">
            {allDirigents.map(m => {
              const name = `${m.first_name} ${m.last_name}`;
              return (
                <MemberRow
                  key={m.id}
                  name={name}
                  checked={youthDirs.has(name)}
                  color="text-yellow-500"
                  onToggle={() => toggle(setYouthDirs, saveYouthDirectors, name)}
                />
              );
            })}
          </div>
        )}
      </Section>

      {/* 3. Choristes expérimentés */}
      <Section
        title="⭐ Choristes expérimentés"
        description="Au moins 2 expérimentés sont sélectionnés en priorité parmi les 6 choristes."
      >
        {choristes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucun choriste trouvé</p>
        ) : (
          <div className="space-y-1.5">
            {choristes.map(m => {
              const name = `${m.first_name} ${m.last_name}`;
              return (
                <MemberRow
                  key={m.id}
                  name={name}
                  checked={expChor.has(name)}
                  color="text-foreground"
                  isExp
                  onToggle={() => toggle(setExpChor, saveExperienced, name)}
                />
              );
            })}
          </div>
        )}
      </Section>

      {/* 4. Musiciens expérimentés */}
      <Section
        title="⭐ Musiciens expérimentés"
        description="Pianistes, batteurs, guitaristes et bassistes prioritaires dans l'algorithme."
      >
        {musiciens.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucun musicien trouvé</p>
        ) : (
          <div className="space-y-1.5">
            {musiciens.map(m => {
              const name = `${m.first_name} ${m.last_name}`;
              return (
                <MemberRow
                  key={m.id}
                  name={name}
                  checked={expMusicians.has(name)}
                  color="text-foreground"
                  isExp
                  onToggle={() => toggle(setExpMusicians, saveExperiencedMusicians, name)}
                />
              );
            })}
          </div>
        )}
      </Section>

    </div>
  );
}
