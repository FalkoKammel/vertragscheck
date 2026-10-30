'use client';

import { useTranslations } from 'next-intl';
import styles from './Footer.module.css';

export function Footer() {
  const t = useTranslations('Footer');

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.disclaimer}>{t('disclaimer')}</div>
        <div className={styles.links}>
          <a href="#impressum">{t('imprint')}</a>
          <a href="#datenschutz">{t('privacy')}</a>
        </div>
      </div>
    </footer>
  );
}
