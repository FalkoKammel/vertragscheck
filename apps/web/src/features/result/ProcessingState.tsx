'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { LinkButton } from '@/components/LinkButton';
import styles from './ProcessingState.module.css';

/** Placeholder until the status endpoint exists: shows that the upload arrived, nothing more. */
export function ProcessingState() {
  const t = useTranslations('Result');
  const id = useSearchParams().get('id');

  if (!id) {
    return (
      <section className={styles.card}>
        <h1 className={styles.title}>{t('missingIdTitle')}</h1>
        <p className={styles.text}>{t('missingIdText')}</p>
        <LinkButton href="/upload" size="md">
          {t('newAnalysis')}
        </LinkButton>
      </section>
    );
  }

  return (
    <div className={styles.progress}>
      <AnalysisProgress heading="h1" phase="analyzing" />
    </div>
  );
}
