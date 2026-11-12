import { Progress } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { cx } from '@/lib/cx';
import styles from './AnalysisProgress.module.css';

const PHASES = ['uploading', 'extracting', 'analysing'] as const;
export type AnalysisPhase = (typeof PHASES)[number];

interface AnalysisProgressProps {
  phase: AnalysisPhase;
  uploadProgress?: number;
  fileName?: string;
}

type StepState = 'done' | 'active' | 'pending';

const MARKER_BY_STATE: Record<StepState, string> = {
  done: styles.markerDone ?? '',
  active: styles.markerActive ?? '',
  pending: styles.markerPending ?? '',
};

export function AnalysisProgress({ phase, uploadProgress = 0, fileName }: AnalysisProgressProps) {
  const t = useTranslations('Progress');
  const percent = Math.round(uploadProgress * 100);

  // Steps before the current phase are done, the current one is active, later ones wait.
  const stateOf = (step: AnalysisPhase): StepState => {
    const diff = PHASES.indexOf(step) - PHASES.indexOf(phase);
    return diff < 0 ? 'done' : diff === 0 ? 'active' : 'pending';
  };
  const uploadState = stateOf('uploading');

  const steps = [
    {
      key: 'upload',
      state: uploadState,
      label: uploadState === 'done' ? t('stepUploaded') : t('stepUploading', { percent }),
    },
    { key: 'extracting', state: stateOf('extracting'), label: t('stepExtracting') },
    { key: 'analysis', state: stateOf('analysing'), label: t('stepAnalysing') },
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
        <Progress value={100} striped animated aria-label={t('stepAnalysing')} />
      )}
      <p className={styles.hint}>{t('hint')}</p>
    </section>
  );
}
