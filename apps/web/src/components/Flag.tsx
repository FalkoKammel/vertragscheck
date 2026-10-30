'use client';

import type { Locale } from 'next-intl';
import styles from './Flag.module.css';

export function Flag({ locale }: { locale: Locale }) {
  if (locale === 'de') {
    return (
      <svg viewBox="0 0 5 3" className={styles.flag} aria-hidden="true">
        <rect width="5" height="3" className={styles.deBlack} />
        <rect y="1" width="5" height="2" className={styles.deRed} />
        <rect y="2" width="5" height="1" className={styles.deGold} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="none" className={styles.flag} aria-hidden="true">
      <rect width="60" height="30" className={styles.ukBlue} />
      <path d="M0 0L60 30M60 0L0 30" className={styles.ukWhiteDiagonal} />
      <path d="M0 0L60 30M60 0L0 30" className={styles.ukRedDiagonal} />
      <path d="M30 0V30M0 15H60" className={styles.ukWhiteCross} />
      <path d="M30 0V30M0 15H60" className={styles.ukRedCross} />
    </svg>
  );
}
