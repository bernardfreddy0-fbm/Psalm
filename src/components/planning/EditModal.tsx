import { useState, useMemo } from 'react';
import { assignSunday, getAbsentMemberIds, type AbsenceWithMember } from '@/lib/api';
import { X, AlertCircle, Check, Loader2 } from 'lucide-react';
import {
  type EditState,
  type MemberOption,
  POLE_KEYS,
  POLE_LABEL,
  POLE_ROLES,
  fmtDateLong,
  type PoleKey,
} from './planningTypes';

// ── EditModal ─────────────────────────────────────────────────────────────────

interface EditModalProps {
  edit: EditState;
  members: MemberOption[];
  absences: AbsenceWithMember[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditModal({ edit, members, absences, onClose, onSaved }: EditModalProps) {
  const [state, setState] = useState<EditState>(edit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // IDs des membres absents ce dimanche
  const absentIds = useMemo(() => getAbsentMemberIds(absences, state.date), [absences, state.date]);

  const dirigeants = members.filter(m =>
    ['responsable_louange','conducteur_louange','dirigeant','pasteur'].some(r =>
      m.role.split(',').map((x: string) => x.trim()).includes(r)
    )
  );

  function addToPole(pole: string, memberId: string) {
    if (!memberId || state.poles[pole]?.includes(memberId)) return;
    const alreadyInOtherPole = Object.entries(state.poles).some(([p, ids]) => p !== pole && ids.includes(memberId));
    if (alreadyInOtherPole) {
      setError(`Ce membre est déjà assigné à un autre pôle pour ce dimanche.`);
      return;
    }
    setError(null);
    setState(s => ({ ...s, poles: { ...s.poles, [pole]: [...(s.poles[pole] ?? []), memberId] } }));
  }

  function removeFromPole(pole: string, memberId: string) {
    setState(s => ({ ...s, poles: { ...s.poles, [pole]: (s.poles[pole] ?? []).filter((id: string) => id !== memberId) } }));
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      await assignSunday(state.sundayId, {
        dirigeant_id: state.dirigeant_id || null,
        note: state.note || null,
        poles: state.poles,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function getMemberName(id: string) {
    const m = members.find((m: MemberOption) => m.id === id);
    return m ? `${m.first_name} ${m.last_name}` : id;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border w-full max-w-2xl my-8 shadow-xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            ✏️ {fmtDateLong(state.date)}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Dirigeant */}
          <div>
            <label className="block text-[10px] font-bold text-primary uppercase tracking-wide mb-1">🎤 Dirigeant</label>
            <select
              value={state.dirigeant_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setState(s => ({ ...s, dirigeant_id: e.target.value }))}
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Sans dirigeant —</option>
              {dirigeants.map((m: MemberOption) => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </div>

          {/* Poles */}
          {POLE_KEYS.map((pole: PoleKey) => {
            const assigned = state.poles[pole] ?? [];
            const poleRoles = POLE_ROLES[pole] ?? [];
            const polePool = poleRoles.length > 0
              ? members.filter((m: MemberOption) =>
                  m.role.split(',').map((r: string) => r.trim()).some(r => poleRoles.includes(r))
                )
              : members;
            // Séparer disponibles et absents parmi les non-assignés
            const notAssigned = polePool.filter((m: MemberOption) => !assigned.includes(m.id));
            const disponibles = notAssigned.filter((m: MemberOption) => !absentIds.has(m.id));
            const absentsPool = notAssigned.filter((m: MemberOption) => absentIds.has(m.id));

            return (
              <div key={pole}>
                <label className="block text-[10px] font-bold text-primary uppercase tracking-wide mb-1">
                  {POLE_LABEL[pole]}
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {assigned.map((id: string) => {
                    const isAbsent = absentIds.has(id);
                    return (
                      <span
                        key={id}
                        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
                          isAbsent
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-primary/10 text-primary'
                        }`}
                        title={isAbsent ? 'Absent ce dimanche' : undefined}
                      >
                        {isAbsent && <span className="text-[9px]">⚠</span>}
                        {getMemberName(id)}
                        <button onClick={() => removeFromPole(pole, id)} className="hover:text-destructive ml-0.5">
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                  {assigned.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">Personne assigné</span>
                  )}
                </div>
                <select
                  value=""
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { addToPole(pole, e.target.value); e.target.value = ''; }}
                  className="bg-background border border-input rounded-md px-3 py-1.5 text-sm text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">+ Ajouter…</option>
                  {/* Membres disponibles */}
                  {disponibles.length > 0 && (
                    <optgroup label="Disponibles">
                      {disponibles.map((m: MemberOption) => (
                        <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                      ))}
                    </optgroup>
                  )}
                  {/* Membres absents (désactivés) */}
                  {absentsPool.length > 0 && (
                    <optgroup label="⚠ Absents ce dimanche">
                      {absentsPool.map((m: MemberOption) => (
                        <option key={m.id} value={m.id} disabled>
                          {m.first_name} {m.last_name} — absent
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {absentsPool.length > 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    ⚠ {absentsPool.length} membre{absentsPool.length > 1 ? 's' : ''} absent{absentsPool.length > 1 ? 's' : ''} ce dimanche
                  </p>
                )}
              </div>
            );
          })}

          {/* Note */}
          <div>
            <label className="block text-[10px] font-bold text-primary uppercase tracking-wide mb-1">📝 Note</label>
            <textarea
              rows={2}
              value={state.note}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setState(s => ({ ...s, note: e.target.value }))}
              placeholder="Note interne..."
              className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              <AlertCircle size={14} />{error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
