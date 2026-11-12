import { NoTextLayerError } from './DomainError';
import { storedClauseSchema, type LlmClause, type StoredClause } from './schemas';

export interface QuoteVerificationResult {
  clauses: StoredClause[];
  unverifiedQuotes: number;
}

const MIN_CHARS_PER_PAGE = 100;
const KEEP_HYPHEN_BEFORE = '(?:und|oder|bis|sowie|bzw)';

const HYPHEN_KEEP = new RegExp(`-\\n(?=${KEEP_HYPHEN_BEFORE}(?![\\p{L}]))`, 'gu');
const HYPHEN_REMOVE = /-\n(?=\p{Ll})/gu;
const STARTS_LOWERCASE = /^\p{Ll}/u;
const STARTS_WITH_KEEP_WORD = new RegExp(`^${KEEP_HYPHEN_BEFORE}(?![\\p{L}])`, 'u');
const ENDS_SENTENCE = /[.:;?!]$/;

function normalizeMarks(s: string): string {
  return s.replace(/[„“”«»]/g, '"').replace(/[‚‘’]/g, "'");
}

function cleanParagraph(paragraph: string): string {
  return paragraph
    .replace(HYPHEN_KEEP, '- ')
    .replace(HYPHEN_REMOVE, '')
    .replace(/\n/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function clean(raw: string): string {
  const lines = raw
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());
  return lines
    .join('\n')
    .split(/\n{2,}/)
    .map(cleanParagraph)
    .filter((p) => p.length > 0)
    .join('\n\n')
    .trim();
}

function joinPages(pages: string[]): { value: string; pageStarts: number[] } {
  let value = '';
  let hasText = false;
  const pageStarts: number[] = [];
  let waitingEmpty = 0;

  for (const page of pages) {
    if (page.length === 0) {
      waitingEmpty++;
      continue;
    }
    if (hasText) {
      const continues = STARTS_LOWERCASE.test(page);
      if (continues && value.endsWith('-') && !STARTS_WITH_KEEP_WORD.test(page)) {
        value = value.slice(0, -1);
      } else if (continues && !ENDS_SENTENCE.test(value)) {
        value += ' ';
      } else {
        value += '\n\n';
      }
    }
    for (; waitingEmpty > 0; waitingEmpty--) pageStarts.push(value.length);
    pageStarts.push(value.length);
    value += page;
    hasText = true;
  }
  for (; waitingEmpty > 0; waitingEmpty--) pageStarts.push(value.length);
  return { value, pageStarts };
}

export class ContractText {
  private constructor(
    readonly value: string,
    readonly pageStarts: readonly number[],
  ) {}

  get pageCount(): number {
    return this.pageStarts.length;
  }

  static fromExtracted(pages: string[]): ContractText {
    const { value, pageStarts } = joinPages(pages.map(clean));
    return new ContractText(value, pageStarts);
  }

  static fromStored(value: string, pageStarts: readonly number[] = [0]): ContractText {
    return new ContractText(value, pageStarts);
  }

  assertHasTextLayer(pageCount: number): void {
    if (pageCount <= 0 || this.value.length / pageCount < MIN_CHARS_PER_PAGE) {
      throw new NoTextLayerError();
    }
  }

  verifyQuotes(clauses: LlmClause[]): QuoteVerificationResult {
    const haystack = normalizeMarks(this.value);
    const verified: StoredClause[] = [];
    let unverifiedQuotes = 0;

    for (const clause of clauses) {
      const needle = normalizeMarks(clause.quote.normalize('NFKC')).replace(/\s+/g, ' ').trim();
      const start = needle.length > 0 ? haystack.indexOf(needle) : -1;
      if (start === -1) {
        unverifiedQuotes++;
        continue;
      }
      const end = start + needle.length;
      const candidate = {
        ...(clause.ref !== undefined ? { ref: clause.ref } : {}),
        category: clause.category,
        level: clause.level,
        quote: this.value.slice(start, end),
        reason: clause.reason,
        start,
        end,
      };
      const parsed = storedClauseSchema.safeParse(candidate);
      if (parsed.success) verified.push(parsed.data);
      else unverifiedQuotes++;
    }
    return { clauses: verified, unverifiedQuotes };
  }
}
