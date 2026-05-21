import { type Sunday } from '@/lib/api';
import { X, Loader2 } from 'lucide-react';
import { type MemberOption, type PreviewAssignment, fmtDate } from './planningTypes';

// ── Generate Preview Modal ────────────────────────────────────────────────────

interface GeneratePreviewModalProps {
  variants: PreviewAssignment[][];
  activeVariant: number;
  onSelectVariant: (i: number) => void;
  sundays: Sunday[];
  members: MemberOption[];
  onConfirm: () => void;
  onClose: () => void;
  generating: boolean;
}

export function GeneratePreviewModal({
  variants,
  activeVariant,
  onSelectVariant,
  sundays,
  members,
  onConfirm,
  onClose,
  generating,
}: GeneratePreviewModalProps) {
  const assignments = variants[activeVariant] ?? [];

  function getMemberName(id: string) {
    const m = members.find(m => m.id === id);
    return m ? `${m.first_name} ${m.last_name}` : id;
  }

  function getSundayDate(sundayId: string) {
    const s = sundays.find(s => s.id === sundayId);
    return s ? fmtDate(s.date) : sundayId;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border w-full max-w-2xl my-8 shadow-xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-sm text-foreground">
            Prévisualisation — {assignments.length} dimanche(s)
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Variant tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-1">
          {variants.map((_, i) => (
            <button
              key={i}
              onClick={() => onSelectVariant(i)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeVariant === i
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Variante {i + 1}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[55vh] overflow-y-auto space-y-3">
          {assignments.map(a => (
            <div key={a.sundayId} className="rounded-lg border border-border p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
                {getSundayDate(a.sundayId)}
                {!!a.is_jeunesse && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 font-medium">
                    Jeunesse
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                <div><span className="text-foreground font-medium">Dirigeant:</span> {a.dirigeant_id ? getMemberName(a.dirigeant_id) : '—'}</div>
                <div><span className="text-foreground font-medium">Choristes:</span> {(a.poles.choriste || []).map(getMemberName).join(', ') || '—'}</div>
                <div><span className="text-foreground font-medium">Piano:</span> {(a.poles.piano || []).map(getMemberName).join(', ') || '—'}</div>
                <div><span className="text-foreground font-medium">Batterie:</span> {(a.poles.batterie || []).map(getMemberName).join(', ') || '—'}</div>
                <div><span className="text-foreground font-medium">Guitare:</span> {[...(a.poles.guitare_elec || []), ...(a.poles.guitare_acou || [])].map(getMemberName).join(', ') || '—'}</div>
                <div><span className="text-foreground font-medium">Basse:</span> {(a.poles.basse || []).map(getMemberName).join(', ') || '—'}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-md">
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-60"
          >
            {generating && <Loader2 size={14} className="animate-spin" />}
            Appliquer la variante {activeVariant + 1} ({assignments.length} dim.)
          </button>
        </div>
      </div>
    </div>
  );
}
