import { type Sunday } from '@/lib/api';

// ── WhatsApp share ────────────────────────────────────────────────────────────

export const POLE_EMOJI: Record<string, string> = {
  dirigeant: '🎤', choriste: '🎵', piano: '🎹', batterie: '🥁',
  guitare_elec: '🎸', guitare_acou: '🎸', basse: '🎶',
  sonorisation: '🎛️', projection: '📽️', video: '🎥',
};

export const POLE_LABEL_WA: Record<string, string> = {
  dirigeant: 'Dirigeant', choriste: 'Choristes', piano: 'Piano',
  batterie: 'Batterie', guitare_elec: 'Guitare élec.', guitare_acou: 'Guitare acou.',
  basse: 'Basse', sonorisation: 'Sonorisation', projection: 'Projection', video: 'Vidéo',
};

export function buildWhatsAppMessage(s: Sunday): string {
  const date = new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const title = !!s.is_jeunesse ? '🌟 Culte Jeunesse' : '✝️ Culte du Dimanche';

  const lines: string[] = [
    `${title}`,
    `📅 ${date.charAt(0).toUpperCase() + date.slice(1)}`,
    '',
  ];

  if (s.dir_first) {
    lines.push(`🎤 *Dirigeant :* ${s.dir_first} ${s.dir_last}`);
  }

  const poles = Object.entries(s.assignments ?? {}).filter(([, people]) => people.length > 0);
  poles
    .filter(([pole]) => pole !== 'dirigeant')
    .forEach(([pole, people]) => {
      const emoji = POLE_EMOJI[pole] ?? '🎵';
      const label = POLE_LABEL_WA[pole] ?? pole;
      const names = people.map(p => p.first_name).join(', ');
      lines.push(`${emoji} *${label} :* ${names}`);
    });

  lines.push('');
  lines.push(`👉 Retrouve ton équipe sur : https://psalm.a-e-f.fr/communaute`);

  return lines.join('\n');
}

export function shareOnWhatsApp(s: Sunday) {
  const msg = buildWhatsAppMessage(s);
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}
