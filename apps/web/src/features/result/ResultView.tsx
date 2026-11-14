'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { AnalysisError } from '@/components/AnalysisError';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { isSampleId } from '@/lib/api/getSample';
import { LinkButton } from '@/components/LinkButton';
import { analysisErrorKey, isAnalysisId, toPhase } from './analysisView';
import { AnalysisResult } from './AnalysisResult';
import { useAnalysis } from './useAnalysis';
import { useSampleAnalysis } from './useSampleAnalysis';
import styles from './ResultView.module.css';

export function ResultView() {
  const t = useTranslations('Result');
  const tError = useTranslations('AnalysisError');
  const id = useSearchParams().get('id');
  const locale = useLocale();
  const isSample = id?.startsWith('sample-') ?? false;
  const sampleId = id !== null && isSampleId(id) ? id : null;
  const validId = id !== null && !isSample && isAnalysisId(id) ? id : null;
  const live = useAnalysis(validId);
  const sample = useSampleAnalysis(sampleId, locale);
  const { data: analysis, error } = isSample ? sample : live;

  if (id === null) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1 className={styles.title}>{t('missingIdTitle')}</h1>
          <p className={styles.text}>{t('missingIdText')}</p>
          <LinkButton href="/upload" size="md">
            {t('newAnalysis')}
          </LinkButton>
        </section>
      </main>
    );
  }

  const errorKey =
    validId === null && sampleId === null ? 'notFound' : analysisErrorKey(analysis, error);
  if (errorKey) {
    return (
      <main className={styles.page}>
        <div className={styles.progress}>
          <AnalysisError
            errorKey={errorKey}
            action={
              <LinkButton href="/upload" size="md">
                {errorKey === 'notFound' ? tError('toUpload') : tError('tryAgain')}
              </LinkButton>
            }
          />
        </div>
      </main>
    );
  }

  if (analysis?.status === 'done') {
    if (!analysis.result) {
      return (
        <main className={styles.page}>
          <div className={styles.progress}>
            <AnalysisError
              errorKey="internal"
              action={
                <LinkButton href="/upload" size="md">
                  {tError('tryAgain')}
                </LinkButton>
              }
            />
          </div>
        </main>
      );
    }
    return (
      <AnalysisResult analysis={{ ...analysis, result: analysis.result }} isSample={isSample} />
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.progress}>
        <AnalysisProgress phase={toPhase(analysis)} />
      </div>
    </main>
  );
}
