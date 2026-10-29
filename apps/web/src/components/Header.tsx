'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { LocaleSwitch } from './LocaleSwitch';
import { cx } from '@/lib/cx';
import styles from './Header.module.css';

const REPO_URL = 'https://github.com/FalkoKammel/vertragscheck';

export function Header() {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const isResult = pathname === '/result';
  const isTransparency = pathname === '/transparency';

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={t('home')}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className={styles.logo}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5" />
            <path d="M9 14l2 2 4-4" />
          </svg>
          <span className={styles.brandName}>{t('brand')}</span>
        </Link>
        <nav className={styles.nav} aria-label={t('navLabel')}>
          {isResult ? (
            <Link href="/upload" className={styles.link}>
              {t('newAnalysis')}
            </Link>
          ) : (
            <Link href="/" className={styles.link}>
              {t('howItWorks')}
            </Link>
          )}
          <Link
            href="/transparency"
            className={cx(styles.link, isTransparency && styles.active)}
            aria-current={isTransparency ? 'page' : undefined}
          >
            {t('transparency')}
          </Link>
          <a href={REPO_URL} className={styles.link} target="_blank" rel="noopener noreferrer">
            {t('github')}
          </a>
          <LocaleSwitch />
        </nav>
      </div>
    </header>
  );
}
