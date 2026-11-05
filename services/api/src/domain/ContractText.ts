import { NoTextLayerError } from './DomainError';
import { storedClauseSchema, type LlmClause, type StoredClause } from './schemas';

export interface QuoteVerificationResult {
  clauses: StoredClause[];
  dropped: number;
}

const MIN_CHARS_PER_PAGE = 100;
const KEEP_HYPHEN_BEFORE = '(?:und|oder|bis|sowie|bzw)';

const HYPHEN_KEEP = new RegExp(`-\\n(?=${KEEP_HYPHEN_BEFORE}(?![\\p{L}]))`, 'gu');
const HYPHEN_REMOVE = /-\n(?=\p{Ll})/gu;

/** 1:1 character replacements, so offsets never shift. */
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

export class ContractText {
  private constructor(readonly value: string) {}

  static fromExtracted(pages: string[]): ContractText {
    return new ContractText(clean(pages.join('\n\n')));
  }

  /** For text loaded from S3: already cleaned. */
  static fromStored(value: string): ContractText {
    return new ContractText(value);
  }

  /** Throws when the text is too short for the page count (likely a scanned PDF). */
  assertHasTextLayer(pageCount: number): void {
    if (pageCount <= 0 || this.value.length / pageCount < MIN_CHARS_PER_PAGE) {
      throw new NoTextLayerError();
    }
  }

  verifyQuotes(clauses: LlmClause[]): QuoteVerificationResult {
    const haystack = normalizeMarks(this.value);
    const verified: StoredClause[] = [];
    let dropped = 0;

    for (const clause of clauses) {
      const needle = normalizeMarks(clause.quote.normalize('NFKC')).replace(/\s+/g, ' ').trim();
      const start = needle.length > 0 ? haystack.indexOf(needle) : -1;
      if (start === -1) {
        dropped++;
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
      else dropped++;
    }
    return { clauses: verified, dropped };
  }
}
