'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { Flag } from './Flag';
import styles from './Header.module.css';

export function LocaleSwitch() {
  const t = useTranslations('Header');
  const locale = useLocale();
  const pathname = usePathname();
  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  return (
    <Link
      href={pathname}
      locale={other}
      lang={other}
      hrefLang={other}
      className={cx(styles.link, styles.localeLink)}
      aria-label={t('switchLanguageLabel')}
    >
      <Flag locale={other} />
      {t('switchLanguage')}
    </Link>
  );
}
