import { describe, it, expect } from 'vitest';
import { ContractText } from './ContractText';
import { storedClauseSchema, type LlmClause } from './schemas';
import { NoTextLayerError } from './DomainError';

describe('clean text', () => {
  it('joins lines within a paragraph', () => {
    expect(ContractText.fromExtracted(['Die Miete\nbeträgt 900 €.']).value).toBe(
      'Die Miete beträgt 900 €.',
    );
  });
  it('keeps paragraph breaks', () => {
    expect(ContractText.fromExtracted(['§ 1 Miete\n\n§ 2 Kaution']).value).toBe(
      '§ 1 Miete\n\n§ 2 Kaution',
    );
  });
  it('removes hyphenation at line ends', () => {
    expect(ContractText.fromExtracted(['Die Kau-\ntion beträgt']).value).toBe(
      'Die Kaution beträgt',
    );
  });
  it('keeps real hyphens', () => {
    expect(ContractText.fromExtracted(['Schönheits-\nund Kleinreparaturen']).value).toBe(
      'Schönheits- und Kleinreparaturen',
    );
  });
  it('resolves ligatures', () => {
    expect(ContractText.fromExtracted(['Pﬂichten']).value).toBe('Pflichten');
  });
  it('collapses multiple spaces', () => {
    expect(ContractText.fromExtracted(['Die   Miete']).value).toBe('Die Miete');
  });
});

describe('verify quotes', () => {
  const contractText = ContractText.fromExtracted([
    'Die Kaution beträgt drei Monatsmieten. Haustiere sind verboten.',
  ]);
  const llmClause: LlmClause = {
    category: 'pets',
    level: 'critical',
    quote: 'Haustiere sind verboten.',
    reason: 'Haustiere dürfen nicht generell verboten werden',
  };

  it('finds an exact quote with correct offsets', () => {
    const result = contractText.verifyQuotes([llmClause]);

    expect(result.dropped).toBe(0);
    expect(result.clauses).toHaveLength(1);
    const [clause] = result.clauses;
    if (!clause) throw new Error('expected one clause');
    expect(clause).toMatchObject({ category: 'pets', level: 'critical', reason: llmClause.reason });
    expect(contractText.value.slice(clause.start, clause.end)).toBe('Haustiere sind verboten.');
    expect(clause.quote).toBe(contractText.value.slice(clause.start, clause.end));
  });

  it('tolerates different quote marks and whitespace in the quote', () => {
    const text = ContractText.fromExtracted(['Der Mieter hat „Haustiere“ nur\nmit Zustimmung.']);
    const clause: LlmClause = {
      ...llmClause,
      quote: '"Haustiere"   nur mit  Zustimmung.',
    };
    const result = text.verifyQuotes([clause]);

    expect(result.dropped).toBe(0);
    const [found] = result.clauses;
    expect(found?.quote).toBe('„Haustiere“ nur mit Zustimmung.');
    expect(found?.quote).toBe(text.value.slice(found?.start, found?.end));
  });

  it('drops a quote that is not in the text and counts it', () => {
    const llmClauseWithoutQuote: LlmClause = {
      category: 'pets',
      level: 'critical',
      quote: 'Haustiere ist verboten.',
      reason: 'Haustiere dürfen nicht generell verboten werden',
    };
    const result = contractText.verifyQuotes([llmClauseWithoutQuote]);
    expect(result.dropped).toBe(1);
    expect(result.clauses).toHaveLength(0);
  });
  it('uses the first occurrence when the quote appears twice', () => {
    const text = ContractText.fromExtracted([
      'Haustiere sind verboten. Ja, Haustiere sind verboten.',
    ]);
    const [clause] = text.verifyQuotes([llmClause]).clauses;
    expect(clause?.start).toBe(0);
  });

  it('matches case-sensitively', () => {
    const result = contractText.verifyQuotes([{ ...llmClause, quote: 'haustiere sind verboten.' }]);
    expect(result).toEqual({ clauses: [], dropped: 1 });
  });

  it('returns an empty result for empty input', () => {
    expect(contractText.verifyQuotes([])).toEqual({ clauses: [], dropped: 0 });
  });

  it('produces clauses that pass storedClauseSchema and keeps ref', () => {
    const result = contractText.verifyQuotes([{ ...llmClause, ref: '§ 7' }]);
    expect(storedClauseSchema.safeParse(result.clauses[0]).success).toBe(true);
    expect(result.clauses[0]?.ref).toBe('§ 7');
  });

  it('keeps valid clauses and counts only the dropped ones', () => {
    const missing: LlmClause = { ...llmClause, quote: 'gibt es nicht' };
    const result = contractText.verifyQuotes([missing, llmClause]);
    expect(result.dropped).toBe(1);
    expect(result.clauses).toHaveLength(1);
  });
});

describe('more cleaning', () => {
  it('joins pages with a paragraph break', () => {
    expect(ContractText.fromExtracted(['Seite eins', 'Seite zwei']).value).toBe(
      'Seite eins\n\nSeite zwei',
    );
  });
  it('collapses several blank lines and tabs', () => {
    expect(ContractText.fromExtracted(['A\t\tB\n\n\n\nC']).value).toBe('A B\n\nC');
  });
  it('keeps the hyphen before an uppercase letter', () => {
    expect(ContractText.fromExtracted(['Miet-\nVertrag']).value).toBe('Miet- Vertrag');
  });
  it('keeps the hyphen before oder, sowie and bzw.', () => {
    expect(ContractText.fromExtracted(['Wohn-\noder Nutzfläche']).value).toBe(
      'Wohn- oder Nutzfläche',
    );
  });
  it('removes the hyphen before words that only start with und', () => {
    expect(ContractText.fromExtracted(['Un-\nund']).value).toBe('Un- und');
    expect(ContractText.fromExtracted(['Ver-\nundichtung']).value).toBe('Verundichtung');
  });
  it('trims the whole text', () => {
    expect(ContractText.fromExtracted(['  \n Text \n ']).value).toBe('Text');
  });
});

describe('assertHasTextLayer', () => {
  it('throws NoTextLayerError below 100 characters per page', () => {
    const text = ContractText.fromExtracted(['x'.repeat(199)]);
    expect(() => {
      text.assertHasTextLayer(2);
    }).toThrow(NoTextLayerError);
    try {
      text.assertHasTextLayer(2);
    } catch (e) {
      expect(e).toMatchObject({ code: 'NO_TEXT_LAYER' });
    }
  });
  it('passes at 100 characters per page', () => {
    expect(() => {
      ContractText.fromExtracted(['x'.repeat(200)]).assertHasTextLayer(2);
    }).not.toThrow();
  });
  it('throws for a page count of 0', () => {
    expect(() => {
      ContractText.fromExtracted(['x'.repeat(200)]).assertHasTextLayer(0);
    }).toThrow(NoTextLayerError);
  });
});

describe('fromStored', () => {
  it('keeps the value unchanged', () => {
    const raw = 'Die   Miete\nbeträgt  Pﬂichten';
    expect(ContractText.fromStored(raw).value).toBe(raw);
  });
});
