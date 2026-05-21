import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Sunday, SundayPerson } from '@/lib/api';
import { MONTHS } from '@/components/planning/planningTypes';

// ── Thème Marine & Or ─────────────────────────────────────────────────────────

const C = {
  marine:     [27, 42, 94]     as [number, number, number],  // bleu marine
  or:         [200, 160, 60]   as [number, number, number],  // or
  white:      [255, 255, 255]  as [number, number, number],
  text:       [30, 30, 30]     as [number, number, number],
  italic:     [90, 90, 90]     as [number, number, number],
  lineTable:  [210, 210, 210]  as [number, number, number],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPole(s: Sunday, pole: string): SundayPerson[] {
  return (s.assignments?.[pole] ?? []) as SundayPerson[];
}

function personName(p: SundayPerson): string {
  return `${p.first_name} ${p.last_name}`.trim();
}

function poleNames(s: Sunday, pole: string): string {
  return getPole(s, pole).map(personName).filter(Boolean).join(' / ');
}

interface MusicRow { label: string; name: string }

function buildMusicRows(s: Sunday): MusicRow[] {
  const rows: MusicRow[] = [];
  const pianos = getPole(s, 'piano');
  if (pianos.length <= 1) {
    pianos.forEach(p => rows.push({ label: 'Piano', name: personName(p) }));
  } else {
    pianos.forEach((p, i) => rows.push({ label: `Piano ${i + 1}`, name: personName(p) }));
  }
  getPole(s, 'guitare_acou').forEach(p => rows.push({ label: 'Guitare acoustique', name: personName(p) }));
  getPole(s, 'guitare_elec').forEach(p => rows.push({ label: 'Guitare électrique', name: personName(p) }));
  getPole(s, 'basse').forEach(p => rows.push({ label: 'Basse', name: personName(p) }));
  getPole(s, 'batterie').forEach(p => rows.push({ label: 'Batterie', name: personName(p) }));
  return rows;
}

// ── Build doc (partagé entre export et share) ─────────────────────────────────

function buildDoc(sundays: Sunday[], monthIndex: number, year: number): jsPDF {
  const monthName = MONTHS[monthIndex].toUpperCase();
  const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();   // 297
  const pageH  = doc.internal.pageSize.getHeight();  // 210
  const margin = 12;

  // ── Bandeau marine pleine largeur ──────────────────────────────────────────
  doc.setFillColor(...C.marine);
  doc.rect(0, 0, pageW, 22, 'F');

  // Titre blanc centré
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...C.white);
  doc.text(`Planning du mois de ${monthName} ${year}`, pageW / 2, 9.5, { align: 'center' });

  // Sous-titre blanc semi-transparent
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(200, 210, 235); // blanc bleuté doux
  doc.text('Assemblée Évangélique des Frères', pageW / 2, 16, { align: 'center' });

  doc.setTextColor(...C.text);

  // ── Corps du tableau ───────────────────────────────────────────────────────
  // 8 colonnes — largeur utilisable 297 - 2×12 = 273 mm
  // 14 + 37 + 55 + 33 + 49 + 28 + 28 + 29 = 273 ✓

  const body: any[][]   = [];
  const sundayFirstRows = new Set<number>();
  const dateByRow       = new Map<number, string>();
  let rowIdx = 0;

  for (const s of sundays) {
    const choristes  = getPole(s, 'choriste');
    const musicRows  = buildMusicRows(s);
    const projection = poleNames(s, 'projection');
    const video      = poleNames(s, 'video');
    const son        = poleNames(s, 'sonorisation');

    const dirigeant = `${s.dir_first ?? ''} ${s.dir_last ?? ''}`.trim() || (s.dirigeant ?? '');

    const day = String(new Date(s.date + 'T00:00:00').getDate());
    const N   = Math.max(choristes.length, musicRows.length, 1);

    sundayFirstRows.add(rowIdx);
    dateByRow.set(rowIdx, day);

    for (let i = 0; i < N; i++) {
      const row: any[] = [];

      if (i === 0) {
        // Col 0 — date (fond marine, chiffre or via didDrawCell)
        row.push({
          content: '',
          rowSpan: N,
          styles: { halign: 'center', valign: 'middle', fillColor: C.marine },
        });
        // Col 1 — dirigeant
        row.push({
          content: dirigeant,
          rowSpan: N,
          styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 7.5 },
        });
      }

      row.push({ content: choristes[i] ? personName(choristes[i]) : '', styles: { fontSize: 7, halign: 'left', valign: 'middle' } });
      row.push({ content: musicRows[i]?.label ?? '', styles: { fontStyle: 'italic', fontSize: 7, halign: 'left', valign: 'middle', textColor: C.italic } });
      row.push({ content: musicRows[i]?.name  ?? '', styles: { fontSize: 7, halign: 'left', valign: 'middle' } });

      if (i === 0) {
        row.push({ content: projection, rowSpan: N, styles: { fontSize: 7, halign: 'center', valign: 'middle' } });
        row.push({ content: video,      rowSpan: N, styles: { fontSize: 7, halign: 'center', valign: 'middle' } });
        row.push({ content: son,        rowSpan: N, styles: { fontSize: 7, halign: 'center', valign: 'middle' } });
      }

      body.push(row);
      rowIdx++;
    }
  }

  // ── Tableau ────────────────────────────────────────────────────────────────

  autoTable(doc, {
    startY: 24,
    margin: { left: margin, right: margin, bottom: 14 },
    head: [[
      { content: '',              styles: { halign: 'center' } },
      { content: 'Dirigeant',    styles: { halign: 'center' } },
      { content: 'Choristes',    styles: { halign: 'center' } },
      { content: 'Musiciens',    colSpan: 2, styles: { halign: 'center' } },
      { content: 'Projection',   styles: { halign: 'center' } },
      { content: 'Vidéo',        styles: { halign: 'center' } },
      { content: 'Sonorisateur', styles: { halign: 'center' } },
    ]],
    body,
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 37 },
      2: { cellWidth: 55 },
      3: { cellWidth: 33 },
      4: { cellWidth: 49 },
      5: { cellWidth: 28 },
      6: { cellWidth: 28 },
      7: { cellWidth: 29 },
    },
    headStyles: {
      fillColor:   C.marine,
      textColor:   C.white,
      fontStyle:   'bold',
      fontSize:    8,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      lineColor:   C.marine,
      lineWidth:   0,
    },
    styles: {
      fontSize:    7,
      cellPadding: { top: 1.3, bottom: 1.3, left: 2, right: 2 },
      lineColor:   C.lineTable,
      lineWidth:   0.22,
      textColor:   C.text,
      overflow:    'linebreak',
      valign:      'middle',
      fillColor:   C.white,
    },
    alternateRowStyles: { fillColor: C.white },
    theme: 'grid',
    tableLineColor: C.lineTable,
    tableLineWidth: 0.22,

    didDrawCell(data) {
      if (data.section !== 'body') return;
      const { x, y, width, height } = data.cell;
      const ri = data.row.index;

      // Séparateur or entre dimanches
      if (sundayFirstRows.has(ri) && ri > 0) {
        doc.setDrawColor(...C.or);
        doc.setLineWidth(0.6);
        doc.line(x, y, x + width, y);
        doc.setDrawColor(...C.lineTable);
        doc.setLineWidth(0.22);
      }

      // Date : fond marine déjà dans le style, chiffre or dessiné ici
      if (data.column.index === 0 && sundayFirstRows.has(ri)) {
        const day = dateByRow.get(ri);
        if (day) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(...C.or);
          doc.text(day, x + width / 2, y + height / 2 + 0.5, {
            align: 'center',
            baseline: 'middle',
          });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...C.text);
        }
      }

      // Filet or vertical gauche — colonne Dirigeant
      if (data.column.index === 1) {
        doc.setDrawColor(...C.or);
        doc.setLineWidth(2.0);
        doc.line(x, y, x, y + height);
        doc.setDrawColor(...C.lineTable);
        doc.setLineWidth(0.22);
      }
    },
  });

  // ── Footer ─────────────────────────────────────────────────────────────────

  const footerY = pageH - 7;

  // Filet or au-dessus du footer
  doc.setDrawColor(...C.or);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 3.5, pageW - margin, footerY - 3.5);

  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(7);
  doc.setTextColor(...C.marine);
  doc.text(
    'Assemblée Évangélique des Frères  —  10, rue de la Maison Rouge, 77185 Lognes',
    pageW / 2,
    footerY,
    { align: 'center' },
  );

  return doc;
}

// ── Export téléchargement ─────────────────────────────────────────────────────

export function exportPlanningPDF(sundays: Sunday[], monthIndex: number, year: number): void {
  const doc = buildDoc(sundays, monthIndex, year);
  doc.save(`planning-${MONTHS[monthIndex].toLowerCase()}-${year}.pdf`);
}

// ── Partage Web Share API (mobile) + fallback téléchargement ─────────────────

export async function sharePlanningPDF(
  sundays: Sunday[],
  monthIndex: number,
  year: number,
): Promise<'shared' | 'downloaded' | 'error'> {
  try {
    const doc      = buildDoc(sundays, monthIndex, year);
    const monthName = MONTHS[monthIndex];
    const filename  = `planning-${monthName.toLowerCase()}-${year}.pdf`;
    const blob      = doc.output('blob');
    const file      = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title:  `Planning Louange — ${monthName} ${year}`,
        text:   `Planning équipe Louange AEF — ${monthName} ${year}`,
      });
      return 'shared';
    }

    // Fallback : téléchargement classique
    doc.save(filename);
    return 'downloaded';
  } catch (err: any) {
    // L'utilisateur a annulé le partage — ne pas traiter comme erreur
    if (err?.name === 'AbortError') return 'downloaded';
    return 'error';
  }
}
