import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { AnalysisErrorKey } from '@/features/result/analysisView';
import styles from './AnalysisError.module.css';

interface AnalysisErrorProps {
  errorKey: AnalysisErrorKey;
  /** A button or link that leads the user on, for example back to the form. */
  action: ReactNode;
}

export function AnalysisError({ errorKey, action }: AnalysisErrorProps) {
  const t = useTranslations('AnalysisError');
  const notFound = errorKey === 'notFound';

  return (
    <section className={styles.card} role="alert">
      <h1 className={styles.title}>{notFound ? t('notFoundTitle') : t('title')}</h1>
      <p className={styles.text}>{notFound ? t('notFoundText') : t(`reasons.${errorKey}`)}</p>
      {action}
    </section>
  );
}
