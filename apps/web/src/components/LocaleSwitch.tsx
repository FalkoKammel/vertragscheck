'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { Flag } from './Flag';
import styles from './Header.module.css';

function SwitchLink({ search }: { search: string }) {
  const t = useTranslations('Header');
  const locale = useLocale();
  const pathname = usePathname();
  const other = routing.locales.find((l) => l !== locale) ?? routing.defaultLocale;

  return (
    <Link
      href={search ? `${pathname}?${search}` : pathname}
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

/** Keeps the query string (e.g. `?id=` on the result page) when switching the language. */
function SwitchLinkWithQuery() {
  return <SwitchLink search={useSearchParams().toString()} />;
}

export function LocaleSwitch() {
  // useSearchParams needs a Suspense boundary in a static export; until the query is known the
  // link points at the bare path.
  return (
    <Suspense fallback={<SwitchLink search="" />}>
      <SwitchLinkWithQuery />
    </Suspense>
  );
}
