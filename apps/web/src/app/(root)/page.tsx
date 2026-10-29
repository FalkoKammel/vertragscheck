import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Vertragscheck' };

const LANGUAGE_NAMES: Record<string, string> = { de: 'Deutsch', en: 'English' };

export default function RootRedirectPage() {
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=/${routing.defaultLocale}`} />
      <nav className={styles.nav}>
        {routing.locales.map((locale) => (
          <a key={locale} href={`/${locale}`} lang={locale}>
            {LANGUAGE_NAMES[locale]}
          </a>
        ))}
      </nav>
    </>
  );
}
