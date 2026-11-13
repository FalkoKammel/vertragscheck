import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import { cx } from '@/lib/cx';
import type { Segment } from '@/lib/segmentText';
import styles from './AnalysisResult.module.css';

interface Props {
  segments: Segment[];
  selected: number | null;
  hovered: number | null;
  onSelect: (clauseIndexes: number[]) => void;
  onHover: (clauseIndex: number | null) => void;
  mostSevere: (clauseIndexes: number[]) => number | null;
}

export function ContractText({
  segments,
  selected,
  hovered,
  onSelect,
  onHover,
  mostSevere,
}: Props) {
  const t = useTranslations('Result');

  return (
    <article aria-label={t('textAria')} className={styles.text}>
      <div className={styles.textLabel}>{t('textLabel')}</div>
      <div className={styles.contract}>
        {segments.map((segment, i) => {
          const previousPage = segments[i - 1]?.page ?? 1;
          const divider =
            segment.page > previousPage ? (
              <div className={styles.pageDivider}>{t('page', { page: segment.page })}</div>
            ) : null;

          if (!segment.level) {
            return (
              <Fragment key={segment.start}>
                {divider}
                <span>{segment.text}</span>
              </Fragment>
            );
          }

          const isSelected = selected !== null && segment.clauseIndexes.includes(selected);
          const isHovered = hovered !== null && segment.clauseIndexes.includes(hovered);
          return (
            <Fragment key={segment.start}>
              {divider}
              {/* Marks are mouse-only on purpose: the clause cards are the accessible path. */}
              <mark
                className={cx(
                  styles.mark,
                  styles[segment.level],
                  isSelected && styles.selected,
                  isHovered && styles.hovered,
                )}
                data-level={segment.level}
                data-clauses={segment.clauseIndexes.join(' ')}
                data-selected={isSelected || undefined}
                onClick={() => {
                  onSelect(segment.clauseIndexes);
                }}
                onMouseEnter={() => {
                  onHover(mostSevere(segment.clauseIndexes));
                }}
                onMouseLeave={() => {
                  onHover(null);
                }}
              >
                {segment.text}
              </mark>
            </Fragment>
          );
        })}
      </div>
    </article>
  );
}
