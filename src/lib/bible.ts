export interface BibleBook {
  id: string;
  name: string;
  abbr: string;
  chapters: number;
  testament: 'AT' | 'NT';
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Ancien Testament
  { id: 'gen', name: 'Genèse', abbr: 'Gn', chapters: 50, testament: 'AT' },
  { id: 'exo', name: 'Exode', abbr: 'Ex', chapters: 40, testament: 'AT' },
  { id: 'lev', name: 'Lévitique', abbr: 'Lv', chapters: 27, testament: 'AT' },
  { id: 'num', name: 'Nombres', abbr: 'Nb', chapters: 36, testament: 'AT' },
  { id: 'deu', name: 'Deutéronome', abbr: 'Dt', chapters: 34, testament: 'AT' },
  { id: 'jos', name: 'Josué', abbr: 'Jos', chapters: 24, testament: 'AT' },
  { id: 'jug', name: 'Juges', abbr: 'Jg', chapters: 21, testament: 'AT' },
  { id: 'rut', name: 'Ruth', abbr: 'Rt', chapters: 4, testament: 'AT' },
  { id: '1sa', name: '1 Samuel', abbr: '1S', chapters: 31, testament: 'AT' },
  { id: '2sa', name: '2 Samuel', abbr: '2S', chapters: 24, testament: 'AT' },
  { id: '1ro', name: '1 Rois', abbr: '1R', chapters: 22, testament: 'AT' },
  { id: '2ro', name: '2 Rois', abbr: '2R', chapters: 25, testament: 'AT' },
  { id: '1ch', name: '1 Chroniques', abbr: '1Ch', chapters: 29, testament: 'AT' },
  { id: '2ch', name: '2 Chroniques', abbr: '2Ch', chapters: 36, testament: 'AT' },
  { id: 'esd', name: 'Esdras', abbr: 'Esd', chapters: 10, testament: 'AT' },
  { id: 'neh', name: 'Néhémie', abbr: 'Né', chapters: 13, testament: 'AT' },
  { id: 'est', name: 'Esther', abbr: 'Est', chapters: 10, testament: 'AT' },
  { id: 'job', name: 'Job', abbr: 'Jb', chapters: 42, testament: 'AT' },
  { id: 'psa', name: 'Psaumes', abbr: 'Ps', chapters: 150, testament: 'AT' },
  { id: 'pro', name: 'Proverbes', abbr: 'Pr', chapters: 31, testament: 'AT' },
  { id: 'ecc', name: 'Ecclésiaste', abbr: 'Ec', chapters: 12, testament: 'AT' },
  { id: 'can', name: 'Cantique des Cantiques', abbr: 'Ct', chapters: 8, testament: 'AT' },
  { id: 'esa', name: 'Ésaïe', abbr: 'Es', chapters: 66, testament: 'AT' },
  { id: 'jer', name: 'Jérémie', abbr: 'Jr', chapters: 52, testament: 'AT' },
  { id: 'lam', name: 'Lamentations', abbr: 'Lm', chapters: 5, testament: 'AT' },
  { id: 'eze', name: 'Ézéchiel', abbr: 'Éz', chapters: 48, testament: 'AT' },
  { id: 'dan', name: 'Daniel', abbr: 'Dn', chapters: 12, testament: 'AT' },
  { id: 'ose', name: 'Osée', abbr: 'Os', chapters: 14, testament: 'AT' },
  { id: 'joe', name: 'Joël', abbr: 'Jl', chapters: 4, testament: 'AT' },
  { id: 'amo', name: 'Amos', abbr: 'Am', chapters: 9, testament: 'AT' },
  { id: 'abd', name: 'Abdias', abbr: 'Ab', chapters: 1, testament: 'AT' },
  { id: 'jon', name: 'Jonas', abbr: 'Jon', chapters: 4, testament: 'AT' },
  { id: 'mic', name: 'Michée', abbr: 'Mi', chapters: 7, testament: 'AT' },
  { id: 'nah', name: 'Nahum', abbr: 'Na', chapters: 3, testament: 'AT' },
  { id: 'hab', name: 'Habakuk', abbr: 'Ha', chapters: 3, testament: 'AT' },
  { id: 'sop', name: 'Sophonie', abbr: 'So', chapters: 3, testament: 'AT' },
  { id: 'agg', name: 'Aggée', abbr: 'Ag', chapters: 2, testament: 'AT' },
  { id: 'zac', name: 'Zacharie', abbr: 'Za', chapters: 14, testament: 'AT' },
  { id: 'mal', name: 'Malachie', abbr: 'Ml', chapters: 3, testament: 'AT' },
  // Nouveau Testament
  { id: 'mat', name: 'Matthieu', abbr: 'Mt', chapters: 28, testament: 'NT' },
  { id: 'mar', name: 'Marc', abbr: 'Mc', chapters: 16, testament: 'NT' },
  { id: 'luc', name: 'Luc', abbr: 'Lc', chapters: 24, testament: 'NT' },
  { id: 'jea', name: 'Jean', abbr: 'Jn', chapters: 21, testament: 'NT' },
  { id: 'act', name: 'Actes', abbr: 'Ac', chapters: 28, testament: 'NT' },
  { id: 'rom', name: 'Romains', abbr: 'Rm', chapters: 16, testament: 'NT' },
  { id: '1co', name: '1 Corinthiens', abbr: '1Co', chapters: 16, testament: 'NT' },
  { id: '2co', name: '2 Corinthiens', abbr: '2Co', chapters: 13, testament: 'NT' },
  { id: 'gal', name: 'Galates', abbr: 'Ga', chapters: 6, testament: 'NT' },
  { id: 'eph', name: 'Éphésiens', abbr: 'Ép', chapters: 6, testament: 'NT' },
  { id: 'phi', name: 'Philippiens', abbr: 'Ph', chapters: 4, testament: 'NT' },
  { id: 'col', name: 'Colossiens', abbr: 'Col', chapters: 4, testament: 'NT' },
  { id: '1th', name: '1 Thessaloniciens', abbr: '1Th', chapters: 5, testament: 'NT' },
  { id: '2th', name: '2 Thessaloniciens', abbr: '2Th', chapters: 3, testament: 'NT' },
  { id: '1ti', name: '1 Timothée', abbr: '1Tm', chapters: 6, testament: 'NT' },
  { id: '2ti', name: '2 Timothée', abbr: '2Tm', chapters: 4, testament: 'NT' },
  { id: 'tit', name: 'Tite', abbr: 'Tt', chapters: 3, testament: 'NT' },
  { id: 'phm', name: 'Philémon', abbr: 'Phm', chapters: 1, testament: 'NT' },
  { id: 'heb', name: 'Hébreux', abbr: 'Hé', chapters: 13, testament: 'NT' },
  { id: 'jac', name: 'Jacques', abbr: 'Jc', chapters: 5, testament: 'NT' },
  { id: '1pi', name: '1 Pierre', abbr: '1P', chapters: 5, testament: 'NT' },
  { id: '2pi', name: '2 Pierre', abbr: '2P', chapters: 3, testament: 'NT' },
  { id: '1je', name: '1 Jean', abbr: '1Jn', chapters: 5, testament: 'NT' },
  { id: '2je', name: '2 Jean', abbr: '2Jn', chapters: 1, testament: 'NT' },
  { id: '3je', name: '3 Jean', abbr: '3Jn', chapters: 1, testament: 'NT' },
  { id: 'jud', name: 'Jude', abbr: 'Jd', chapters: 1, testament: 'NT' },
  { id: 'apo', name: 'Apocalypse', abbr: 'Ap', chapters: 22, testament: 'NT' },
];

export function formatReference(book: string, chapter: string, verses: string): string {
  const b = BIBLE_BOOKS.find(bb => bb.id === book || bb.name === book);
  const name = b?.name || book;
  if (!chapter) return name;
  if (!verses) return `${name} ${chapter}`;
  return `${name} ${chapter}.${verses}`;
}
