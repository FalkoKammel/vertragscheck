import type { AnalysisResponse, Clause } from '../lib/api/analyses';

export const FIXTURE_STATES = ['pending_upload', 'running', 'analysing', 'done', 'failed'] as const;
export type FixtureState = (typeof FIXTURE_STATES)[number];

const PARAGRAPHS = [
  'Wohnraummietvertrag zwischen Herrn Thomas Beispiel, Musterweg 1, 10115 Berlin (Vermieter) und Frau Anna Muster (Mieterin).',
  '§ 1 Mietsache. Vermietet wird die Wohnung im 2. Obergeschoss links des Hauses Musterweg 1 in 10115 Berlin mit drei Zimmern, Küche und Bad sowie einem Kellerraum.',
  '§ 2 Mietzeit. Das Mietverhältnis beginnt am 1. Januar 2027 und läuft auf unbestimmte Zeit.',
  '§ 3 Miete. Die monatliche Nettokaltmiete beträgt 850,00 Euro. Zusätzlich zahlt die Mieterin eine Vorauszahlung auf die Betriebskosten von 180,00 Euro.',
  '§ 4 Sicherheitsleistung. Die Mieterin leistet eine Kaution in Höhe von vier Nettokaltmieten, das sind 3.400,00 Euro, in einer Summe bei Übergabe der Wohnung.',
  '§ 5 Schönheitsreparaturen. Die Mieterin ist verpflichtet, die Wohnung bei Auszug renoviert und frisch gestrichen zurückzugeben, unabhängig vom Zustand bei Einzug.',
  '§ 6 Tierhaltung. Die Haltung von Hunden und Katzen bedarf der vorherigen schriftlichen Zustimmung des Vermieters.',
  '§ 7 Schlussbestimmungen. Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform.',
];
const TEXT = PARAGRAPHS.join('\n\n');

function clause(quote: string, rest: Omit<Clause, 'quote' | 'start' | 'end'>): Clause {
  const start = TEXT.indexOf(quote);
  if (start < 0) throw new Error(`Fixture quote not found: ${quote}`);
  return { ...rest, quote, start, end: start + quote.length };
}

const CLAUSES: Clause[] = [
  clause('Die monatliche Nettokaltmiete beträgt 850,00 Euro.', {
    ref: '§ 3',
    category: 'rent',
    level: 'fine',
    reason:
      'Eine feste Nettokaltmiete ohne Staffel- oder Indexvereinbarung ist üblich und unproblematisch. Ob sie die ortsübliche Vergleichsmiete übersteigt, lässt sich aus dem Vertrag allein nicht beurteilen.',
  }),
  clause('eine Kaution in Höhe von vier Nettokaltmieten', {
    ref: '§ 4',
    category: 'deposit',
    level: 'critical',
    reason:
      'Die Kaution darf höchstens drei Nettokaltmieten betragen (§ 551 Abs. 1 BGB). Die Vereinbarung ist insoweit unwirksam, der übersteigende Betrag kann zurückverlangt werden.',
  }),
  clause(
    'bei Auszug renoviert und frisch gestrichen zurückzugeben, unabhängig vom Zustand bei Einzug',
    {
      ref: '§ 5',
      category: 'cosmetic_repairs',
      level: 'critical',
      reason:
        'Eine starre Endrenovierungspflicht ohne Rücksicht auf den Zustand bei Einzug benachteiligt die Mieterin unangemessen und ist nach ständiger Rechtsprechung des BGH unwirksam (§ 307 BGB).',
    },
  ),
  clause('bedarf der vorherigen schriftlichen Zustimmung des Vermieters', {
    ref: '§ 6',
    category: 'pets',
    level: 'check',
    reason:
      'Ein Zustimmungsvorbehalt für Hunde und Katzen ist grundsätzlich zulässig, die Zustimmung darf aber nicht willkürlich verweigert werden. Kleintiere sind davon nicht erfasst.',
  }),
];

const BASE = {
  contractType: 'rental',
  language: 'de',
  createdAt: '2026-11-03T10:15:00.000Z',
  expiresAt: '2026-12-03T10:15:00.000Z',
} as const;

export function analysisFixture(state: FixtureState, id: string): AnalysisResponse {
  switch (state) {
    case 'pending_upload':
      return { ...BASE, id, status: 'pending_upload' };
    case 'running':
      return { ...BASE, id, status: 'running', stage: 'extracting' };
    case 'analysing':
      return { ...BASE, id, status: 'running', stage: 'analysing' };
    case 'failed':
      return { ...BASE, id, status: 'failed', failureReason: 'NO_TEXT_LAYER' };
    case 'done':
      return {
        ...BASE,
        id,
        status: 'done',
        result: {
          text: TEXT,
          clauses: CLAUSES,
          unverifiedQuotes: 1,
          invalidClauses: 0,
          run: {
            modelId: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
            promptVersion: 'v3',
            costMicroUsd: 14300,
            latencyMs: 6200,
            inputTokens: 7412,
            outputTokens: 1388,
          },
        },
      };
  }
}
