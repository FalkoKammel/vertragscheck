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

    expect(result.unverifiedQuotes).toBe(0);
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

    expect(result.unverifiedQuotes).toBe(0);
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
    expect(result.unverifiedQuotes).toBe(1);
    expect(result.clauses).toHaveLength(0);
  });
  it('uses the first occurrence when the quote appears twice', () => {
    const text = ContractText.fromExtracted([
      'Haustiere sind verboten. Ja, Haustiere sind verboten.',
    ]);
    const [clause] = text.verifyQuotes([llmClause]).clauses;
    expect(clause?.start).toBe(0);
  });

  it('matches exactly case-sensitively; a case difference only passes as aligned', () => {
    const result = contractText.verifyQuotes([{ ...llmClause, quote: 'haustiere sind verboten.' }]);
    expect(result).toMatchObject({ exactQuotes: 0, alignedQuotes: 1, unverifiedQuotes: 0 });
    expect(result.clauses[0]?.quote).toBe('Haustiere sind verboten.');
  });

  it('returns an empty result for empty input', () => {
    expect(contractText.verifyQuotes([])).toEqual({
      clauses: [],
      exactQuotes: 0,
      alignedQuotes: 0,
      unverifiedQuotes: 0,
    });
  });

  it('produces clauses that pass storedClauseSchema and keeps ref', () => {
    const result = contractText.verifyQuotes([{ ...llmClause, ref: '§ 7' }]);
    expect(storedClauseSchema.safeParse(result.clauses[0]).success).toBe(true);
    expect(result.clauses[0]?.ref).toBe('§ 7');
  });

  it('keeps valid clauses and counts only the unverifiedQuotes ones', () => {
    const missing: LlmClause = { ...llmClause, quote: 'gibt es nicht' };
    const result = contractText.verifyQuotes([missing, llmClause]);
    expect(result.unverifiedQuotes).toBe(1);
    expect(result.clauses).toHaveLength(1);
  });
});

describe('verify quotes by token alignment', () => {
  const rental = ContractText.fromExtracted([
    '(1) Der Mieter leistet eine Kaution in Höhe von vier Nettokaltmieten, das sind 3.680,00 Euro.\n\n' +
      '(2) Die Kaution ist vor Übergabe der Wohnung in einer Summe zu zahlen. Eine Zahlung in Teilbeträgen ist ausgeschlossen.\n\n' +
      '(3) Die Kaution wird verzinst angelegt.',
  ]);
  const clause = (quote: string): LlmClause => ({
    category: 'deposit',
    level: 'critical',
    quote,
    reason: 'x',
  });
  const joined =
    'Der Mieter leistet eine Kaution in Höhe von vier Nettokaltmieten, das sind 3.680,00 Euro. Die Kaution ist vor Übergabe der Wohnung in einer Summe zu zahlen. Eine Zahlung in Teilbeträgen ist ausgeschlossen.';

  it('aligns a quote whose "(2)" was dropped and sentences were joined', () => {
    const result = rental.verifyQuotes([clause(joined)]);

    expect(result).toMatchObject({ exactQuotes: 0, alignedQuotes: 1, unverifiedQuotes: 0 });
    const [found] = result.clauses;
    expect(found?.quote).toBe(rental.value.slice(found?.start, found?.end));
    expect(found?.quote.startsWith('Der Mieter')).toBe(true);
    expect(found?.quote.endsWith('ausgeschlossen.')).toBe(true);
    expect(found?.quote).toContain('(2)');
  });

  it('extends an aligned span over trailing punctuation but not across whitespace', () => {
    const text = ContractText.fromExtracted([
      'Es gilt: (a) die Frist, („Probezeit“) endet. Danach folgt Neues.',
    ]);
    const result = text.verifyQuotes([clause('die Frist Probezeit endet')]);

    expect(result.alignedQuotes).toBe(1);
    expect(result.clauses[0]?.quote).toBe('die Frist, („Probezeit“) endet.');
  });

  it('aligns the variant with a single newline and "(2) "', () => {
    const quote = joined.replace('Euro. Die', 'Euro.\n(2) Die');
    const result = rental.verifyQuotes([clause(quote)]);

    expect(result).toMatchObject({ exactQuotes: 0, alignedQuotes: 1, unverifiedQuotes: 0 });
  });

  it('aligns across straight vs German quote marks', () => {
    const text = ContractText.fromExtracted([
      'Der Mieter darf „Haustiere“ halten.\n\n(2) Die Zustimmung ist „jederzeit“ widerruflich, wenn Störungen auftreten.',
    ]);
    const result = text.verifyQuotes([
      clause(
        'Der Mieter darf "Haustiere" halten. Die Zustimmung ist "jederzeit" widerruflich, wenn Störungen auftreten.',
      ),
    ]);

    expect(result).toMatchObject({ alignedQuotes: 1, unverifiedQuotes: 0 });
  });

  it('keeps a paraphrased quote with changed words unverified', () => {
    const paraphrase =
      'Der Mieter zahlt als Sicherheit drei Monatsmieten, das sind 2.760,00 Euro. Die Sicherheit ist bei Einzug in einer Summe fällig. Teilzahlungen sind nicht erlaubt.';
    const result = rental.verifyQuotes([clause(paraphrase)]);

    expect(result).toMatchObject({ exactQuotes: 0, alignedQuotes: 0, unverifiedQuotes: 1 });
    expect(result.clauses).toHaveLength(0);
  });

  it('keeps an invented sentence unverified', () => {
    const result = rental.verifyQuotes([
      clause(
        'Der Vermieter darf die Miete jederzeit ohne Begründung um bis zu zehn Prozent erhöhen.',
      ),
    ]);

    expect(result).toMatchObject({ alignedQuotes: 0, unverifiedQuotes: 1 });
    expect(result.clauses).toHaveLength(0);
  });

  it('keeps a quote with a swapped word unverified', () => {
    const result = rental.verifyQuotes([clause(joined.replace('ausgeschlossen', 'gestattet'))]);

    expect(result).toMatchObject({ alignedQuotes: 0, unverifiedQuotes: 1 });
    expect(result.clauses).toHaveLength(0);
  });

  it('keeps a quote with a dropped negation unverified', () => {
    const text = ContractText.fromExtracted([
      'Eine Zahlung in Teilbeträgen ist nicht ausgeschlossen.',
    ]);
    const result = text.verifyQuotes([clause('Eine Zahlung in Teilbeträgen ist ausgeschlossen.')]);

    expect(result).toMatchObject({ exactQuotes: 0, alignedQuotes: 0, unverifiedQuotes: 1 });
    expect(result.clauses).toHaveLength(0);
  });

  it('keeps a quote that omits an amount unverified', () => {
    const result = rental.verifyQuotes([clause(joined.replace('3.680,00 ', ''))]);

    expect(result).toMatchObject({ alignedQuotes: 0, unverifiedQuotes: 1 });
    expect(result.clauses).toHaveLength(0);
  });

  it('skips a "2." marker at the start of a line', () => {
    const text = ContractText.fromExtracted([
      'Die Kaution beträgt drei Monatsmieten.\n\n2. Sie ist in einer Summe zu zahlen.',
    ]);
    const result = text.verifyQuotes([
      clause('Die Kaution beträgt drei Monatsmieten. Sie ist in einer Summe zu zahlen.'),
    ]);

    expect(result).toMatchObject({ alignedQuotes: 1, unverifiedQuotes: 0 });
    expect(result.clauses[0]?.quote).toBe(
      'Die Kaution beträgt drei Monatsmieten.\n\n2. Sie ist in einer Summe zu zahlen.',
    );
  });

  it('does not skip a "(2)" in the middle of a line', () => {
    const text = ContractText.fromExtracted([
      'Die Kaution beträgt drei Monatsmieten. (2) Sie ist in einer Summe zu zahlen.',
    ]);
    const result = text.verifyQuotes([
      clause('Die Kaution beträgt drei Monatsmieten. Sie ist in einer Summe zu zahlen.'),
    ]);

    expect(result).toMatchObject({ alignedQuotes: 0, unverifiedQuotes: 1 });
    expect(result.clauses).toHaveLength(0);
  });

  it('counts an unchanged quote as exact', () => {
    const result = rental.verifyQuotes([clause('Die Kaution wird verzinst angelegt.')]);

    expect(result).toMatchObject({ exactQuotes: 1, alignedQuotes: 0, unverifiedQuotes: 0 });
    expect(result.clauses[0]?.quote).toBe('Die Kaution wird verzinst angelegt.');
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

describe('pages', () => {
  it('joins two pages with a paragraph break and records their starts', () => {
    const text = ContractText.fromExtracted(['Seite eins.', 'Seite zwei.']);
    expect(text.value).toBe('Seite eins.\n\nSeite zwei.');
    expect(text.pageStarts).toEqual([0, 13]);
    expect(text.pageCount).toBe(2);
  });
  it('joins a sentence that continues on the next page with a space', () => {
    const text = ContractText.fromExtracted(['Die Miete beträgt', 'monatlich 900 €.']);
    expect(text.value).toBe('Die Miete beträgt monatlich 900 €.');
    expect(text.pageStarts).toEqual([0, 18]);
  });
  it('keeps a paragraph break after sentence-ending punctuation', () => {
    for (const end of ['.', ':', ';', '?', '!']) {
      expect(ContractText.fromExtracted([`Ende${end}`, 'klein weiter']).value).toBe(
        `Ende${end}\n\nklein weiter`,
      );
    }
  });
  it('keeps a paragraph break before an uppercase start', () => {
    expect(ContractText.fromExtracted(['Ende ohne Punkt', 'Neuer Absatz']).value).toBe(
      'Ende ohne Punkt\n\nNeuer Absatz',
    );
  });
  it('removes the hyphen of a word split across pages', () => {
    const text = ContractText.fromExtracted(['Die Kau-', 'tion beträgt drei Monatsmieten.']);
    expect(text.value).toBe('Die Kaution beträgt drei Monatsmieten.');
    expect(text.pageStarts).toEqual([0, 7]);
  });
  it('keeps the hyphen before und, oder, bis, sowie and bzw. across pages', () => {
    for (const word of ['und', 'oder', 'bis', 'sowie', 'bzw']) {
      expect(ContractText.fromExtracted(['Wohn-', `${word} Nutzfläche`]).value).toBe(
        `Wohn- ${word} Nutzfläche`,
      );
    }
  });
  it('removes the hyphen before words that only start with und across pages', () => {
    expect(ContractText.fromExtracted(['Ver-', 'undichtung']).value).toBe('Verundichtung');
  });
  it('gives an empty middle page the start of the next page', () => {
    const text = ContractText.fromExtracted(['Seite eins.', '  \n ', 'Seite drei.']);
    expect(text.value).toBe('Seite eins.\n\nSeite drei.');
    expect(text.pageStarts).toEqual([0, 13, 13]);
    expect(text.pageCount).toBe(3);
  });
  it('joins around an empty middle page by the same rules', () => {
    const text = ContractText.fromExtracted(['Die Kau-', '', 'tion']);
    expect(text.value).toBe('Die Kaution');
    expect(text.pageStarts).toEqual([0, 7, 7]);
  });
  it('handles empty first and last pages', () => {
    const text = ContractText.fromExtracted(['', 'Text.', '']);
    expect(text.value).toBe('Text.');
    expect(text.pageStarts).toEqual([0, 0, 5]);
  });
  it('has a single start at 0 for one page', () => {
    expect(ContractText.fromExtracted(['Text']).pageStarts).toEqual([0]);
  });
  it('fromStored restores the page starts', () => {
    const text = ContractText.fromStored('A\n\nB', [0, 3]);
    expect(text.pageStarts).toEqual([0, 3]);
    expect(text.pageCount).toBe(2);
  });
});

describe('page markers', () => {
  it('removes a marker at the start and at the end of a page', () => {
    expect(ContractText.fromExtracted(['3\nDie Miete beträgt 900 €.\nSeite 3 von 9']).value).toBe(
      'Die Miete beträgt 900 €.',
    );
  });
  it.each(['7', 'Seite 3', 'SEITE 3 von 9', '3/9', '- 3 -', '– 3 –'])('removes "%s"', (marker) => {
    expect(ContractText.fromExtracted([`Text davor.\n${marker}`]).value).toBe('Text davor.');
    expect(ContractText.fromExtracted([`${marker}\nText danach.`]).value).toBe('Text danach.');
  });
  it('keeps a number inside the text', () => {
    expect(ContractText.fromExtracted(['Erste Zeile\n5\nLetzte Zeile']).value).toBe(
      'Erste Zeile 5 Letzte Zeile',
    );
  });
  it('keeps a first line that merely starts with a number', () => {
    expect(ContractText.fromExtracted(['3 Monate Frist\nweiter']).value).toBe(
      '3 Monate Frist weiter',
    );
  });
  it('joins a sentence across a page break once the marker is gone', () => {
    expect(
      ContractText.fromExtracted(['Gründe liegen vor, wenn', '7\ndie Wohnung genutzt wird.']).value,
    ).toBe('Gründe liegen vor, wenn die Wohnung genutzt wird.');
  });
});
