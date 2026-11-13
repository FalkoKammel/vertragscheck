import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import type { Clause } from '@/lib/api/analyses';
import styles from './AnalysisResult.module.css';

interface Props {
  index: number;
  clause: Clause;
  categoryName: string;
  page: number;
  selected: boolean;
  hovered: boolean;
  onSelect: (index: number) => void;
  onHover: (index: number | null) => void;
}

const LEVEL_KEY = {
  critical: 'levelCritical',
  check: 'levelCheck',
  fine: 'levelFine',
} as const;

export function ClauseCard({
  index,
  clause,
  categoryName,
  page,
  selected,
  hovered,
  onSelect,
  onHover,
}: Props) {
  const t = useTranslations('Result');
  const heading: ReactNode = clause.ref ? `${clause.ref} · ${categoryName}` : categoryName;

  return (
    <button
      type="button"
      id={`clause-card-${String(index)}`}
      aria-pressed={selected}
      className={cx(
        styles.card,
        styles[clause.level],
        selected && styles.cardSelected,
        hovered && styles.cardHovered,
      )}
      onClick={() => {
        onSelect(index);
      }}
      onMouseEnter={() => {
        onHover(index);
      }}
      onMouseLeave={() => {
        onHover(null);
      }}
      onFocus={() => {
        onHover(index);
      }}
      onBlur={() => {
        onHover(null);
      }}
    >
      <span className={styles.cardHead}>
        <span className={styles.cardTitle}>{heading}</span>
        <span className={styles.badge}>{t(LEVEL_KEY[clause.level])}</span>
      </span>
      <span className={styles.quote}>„{clause.quote}“</span>
      <span className={styles.reason}>{clause.reason}</span>
      <span className={styles.cardFoot}>
        <span>{t('page', { page })}</span>
        <span className={styles.found}>{t('quoteFound')}</span>
      </span>
    </button>
  );
}
