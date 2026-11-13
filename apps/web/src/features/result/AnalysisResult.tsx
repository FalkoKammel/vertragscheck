'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisResponse } from '@/lib/api/analyses';
import { cx } from '@/lib/cx';
import { pageAt, segmentText } from '@/lib/segmentText';
import { useRouter } from '@/i18n/navigation';
import { DeleteAnalysisButton } from '../analyses/DeleteAnalysisButton';
import { useStoredAnalyses } from '../analyses/useStoredAnalyses';
import { findStoredAnalysis, readStoredAnalyses } from '../upload/storage';
import { AnalysisStats } from './AnalysisStats';
import { ClauseCard } from './ClauseCard';
import {
  countByLevel,
  employmentCategory,
  fineOrder,
  initialSelection,
  mostSevere,
  notableOrder,
  rentalCategory,
} from './clauses';
import { ContractText } from './ContractText';
import styles from './AnalysisResult.module.css';

type Result = NonNullable<AnalysisResponse['result']>;

interface Props {
  analysis: AnalysisResponse & { result: Result };
}

interface ScrollRequest {
  target: 'mark' | 'card';
  index: number;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

export function AnalysisResult({ analysis }: Props) {
  const t = useTranslations('Result');
  const tAnalyses = useTranslations('Analyses');
  const rentalNames = useTranslations('Categories.rental');
  const employmentNames = useTranslations('Categories.employment');
  const { result } = analysis;
  const { clauses, pageStarts } = result;

  const router = useRouter();
  const [storedName] = useState(() => findStoredAnalysis(analysis.id)?.fileName);
  // Read after mount (static export): only a browser that holds the token may offer deletion.
  const deleteToken = useStoredAnalyses()?.find((e) => e.analysisId === analysis.id)?.deleteToken;
  const [selected, setSelected] = useState<number | null>(() => initialSelection(clauses));
  const [hovered, setHovered] = useState<number | null>(null);
  const [fineOpen, setFineOpen] = useState(false);
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const segments = useMemo(
    () => segmentText(result.text, clauses, pageStarts),
    [result.text, clauses, pageStarts],
  );
  const notable = useMemo(() => notableOrder(clauses), [clauses]);
  const fine = useMemo(() => fineOrder(clauses), [clauses]);
  const counts = countByLevel(clauses);

  // Runs after render so a card in the just-opened fine section already exists.
  useEffect(() => {
    if (!scrollRequest || !root.current) return;
    const selector =
      scrollRequest.target === 'mark'
        ? `mark[data-clauses~="${String(scrollRequest.index)}"]`
        : `#clause-card-${String(scrollRequest.index)}`;
    root.current.querySelector(selector)?.scrollIntoView({
      block: scrollRequest.target === 'mark' ? 'center' : 'nearest',
      behavior: scrollBehavior(),
    });
  }, [scrollRequest]);

  const categoryName = (category: string) =>
    analysis.contractType === 'rental'
      ? rentalNames(rentalCategory(category))
      : employmentNames(employmentCategory(category));

  const typeLabel =
    analysis.contractType === 'rental' ? t('contractTypeRental') : t('contractTypeEmployment');
  const title = storedName ?? typeLabel;
  const pageCount = analysis.pageCount ?? pageStarts?.length ?? 1;

  const selectFromCard = (index: number) => {
    setSelected(index);
    setScrollRequest({ target: 'mark', index });
  };

  const selectFromMark = (clauseIndexes: number[]) => {
    const index = mostSevere(clauseIndexes, clauses);
    if (index === null) return;
    if (clauses[index]?.level === 'fine') setFineOpen(true);
    setSelected(index);
    setScrollRequest({ target: 'card', index });
  };

  const renderCard = (index: number) => {
    const clause = clauses[index];
    if (!clause) return null;
    return (
      <ClauseCard
        key={index}
        index={index}
        clause={clause}
        categoryName={categoryName(clause.category)}
        page={pageAt(clause.start, pageStarts)}
        selected={selected === index}
        hovered={hovered === index}
        onSelect={selectFromCard}
        onHover={setHovered}
      />
    );
  };

  return (
    <div ref={root}>
      <div className={styles.top}>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <div className={styles.meta}>
              {storedName ? `${typeLabel} · ` : ''}
              {t('pages', { count: pageCount })}
            </div>
            <h1 className={styles.title}>{title}</h1>
          </div>
          <div className={styles.pills}>
            <span className={cx(styles.pill, styles.critical)}>
              {t('critical', { count: counts.critical })}
            </span>
            <span className={cx(styles.pill, styles.check)}>
              {t('check', { count: counts.check })}
            </span>
            <span className={cx(styles.pill, styles.fine)}>
              {t('fine', { count: counts.fine })}
            </span>
          </div>
        </div>
        <div role="note" className={styles.note}>
          <p>
            {t('disclaimer')} {t('verifiedNote')}
          </p>
          {result.unverifiedQuotes > 0 && (
            <p>{t('unverifiedNote', { count: result.unverifiedQuotes })}</p>
          )}
        </div>
      </div>

      <main className={styles.main}>
        <ContractText
          segments={segments}
          selected={selected}
          hovered={hovered}
          onSelect={selectFromMark}
          onHover={setHovered}
          mostSevere={(indexes) => mostSevere(indexes, clauses)}
        />

        <aside aria-label={t('clausesAria')} className={styles.aside}>
          <AnalysisStats result={result} expiresAt={analysis.expiresAt} />

          <h2 className={styles.asideTitle}>{t('clausesTitle')}</h2>

          {notable.length === 0 ? (
            <p className={styles.empty}>{t('noNotable')}</p>
          ) : (
            notable.map(renderCard)
          )}

          {fine.length > 0 && (
            <section className={styles.fineSection}>
              <button
                type="button"
                className={styles.fineToggle}
                aria-expanded={fineOpen}
                aria-controls="fine-clauses"
                onClick={() => {
                  setFineOpen((open) => !open);
                }}
              >
                {t('fineToggle', { count: fine.length })}
              </button>
              {fineOpen && (
                <div id="fine-clauses" className={styles.fineList}>
                  {fine.map(renderCard)}
                </div>
              )}
            </section>
          )}

          {deleteToken !== undefined && (
            <div className={styles.deleteBox}>
              <DeleteAnalysisButton
                analysisId={analysis.id}
                deleteToken={deleteToken}
                onDeleted={() => {
                  router.replace(readStoredAnalyses().length > 0 ? '/analyses' : '/');
                }}
              />
              <p className={styles.deleteHint}>{tAnalyses('deleteHint')}</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
