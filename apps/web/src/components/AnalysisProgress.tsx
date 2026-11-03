import { Progress } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { cx } from '@/lib/cx';
import styles from './AnalysisProgress.module.css';

export type AnalysisPhase = 'uploading' | 'analyzing';

interface AnalysisProgressProps {
  phase: AnalysisPhase;
  /** Upload progress from 0 to 1, only used in the `uploading` phase. */
  uploadProgress?: number;
  fileName?: string;
}

type StepState = 'done' | 'active' | 'pending';

const MARKER_BY_STATE: Record<StepState, string> = {
  done: styles.markerDone ?? '',
  active: styles.markerActive ?? '',
  pending: styles.markerPending ?? '',
};

/**
 * One card for everything that happens after "Analyse starten": uploading the PDF, then the
 * analysis. The user sees it as a single process. The backend does not report finer steps
 * yet, so the analysis is one indeterminate step (see "Upload and progress card" in PLAN.md).
 */
export function AnalysisProgress({ phase, uploadProgress = 0, fileName }: AnalysisProgressProps) {
  const t = useTranslations('Progress');
  const percent = Math.round(uploadProgress * 100);

  const uploadState: StepState = phase === 'uploading' ? 'active' : 'done';
  const analysisState: StepState = phase === 'analyzing' ? 'active' : 'pending';

  const steps = [
    {
      key: 'upload',
      state: uploadState,
      label: uploadState === 'done' ? t('stepUploaded') : t('stepUploading', { percent }),
    },
    { key: 'analysis', state: analysisState, label: t('stepAnalyzing') },
  ];

  return (
    <section className={styles.card} aria-label={t('aria')} aria-busy="true" aria-live="polite">
      <h1 className={styles.title}>{t('title')}</h1>
      {fileName ? <div className={styles.file}>{fileName}</div> : null}

      <ol className={styles.steps}>
        {steps.map((step) => (
          <li
            key={step.key}
            className={cx(styles.step, step.state === 'pending' && styles.stepPending)}
            aria-current={step.state === 'active' ? 'step' : undefined}
          >
            <span className={cx(styles.marker, MARKER_BY_STATE[step.state])} aria-hidden="true">
              {step.state === 'done' ? '✓' : null}
            </span>
            <span className={step.state === 'active' ? styles.labelActive : undefined}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      {phase === 'uploading' ? (
        <Progress value={percent} aria-label={t('stepUploading', { percent })} />
      ) : (
        <Progress value={100} striped animated aria-label={t('stepAnalyzing')} />
      )}
      <p className={styles.hint}>{t('hint')}</p>
    </section>
  );
}
