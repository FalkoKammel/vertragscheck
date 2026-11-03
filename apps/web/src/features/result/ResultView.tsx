'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { LinkButton } from '@/components/LinkButton';
import { ResultPlaceholder } from './ResultPlaceholder';
import styles from './ResultView.module.css';

/**
 * Temporary until the status endpoint exists. Sample analyses (`sample-*`) show the static
 * result layout; every other ID shows the progress card, and no ID shows a hint.
 */
export function ResultView() {
  const t = useTranslations('Result');
  const id = useSearchParams().get('id');

  if (id?.startsWith('sample-')) return <ResultPlaceholder />;

  return (
    <main className={styles.page}>
      {id ? (
        <div className={styles.progress}>
          <AnalysisProgress phase="analyzing" />
        </div>
      ) : (
        <section className={styles.card}>
          <h1 className={styles.title}>{t('missingIdTitle')}</h1>
          <p className={styles.text}>{t('missingIdText')}</p>
          <LinkButton href="/upload" size="md">
            {t('newAnalysis')}
          </LinkButton>
        </section>
      )}
    </main>
  );
}
