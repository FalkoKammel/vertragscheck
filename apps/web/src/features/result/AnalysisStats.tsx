import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { AnalysisResponse } from '@/lib/api/analyses';
import { modelLabelKey } from './clauses';
import styles from './AnalysisResult.module.css';

type Result = NonNullable<AnalysisResponse['result']>;

interface Props {
  result: Result;
  expiresAt: string;
}

const MODEL_MESSAGE = { haiku45Eu: 'modelHaiku45Eu', haiku45: 'modelHaiku45' } as const;

export function AnalysisStats({ result, expiresAt }: Props) {
  const t = useTranslations('Result');
  const format = useFormatter();
  const { run } = result;

  const modelKey = modelLabelKey(run.modelId);
  const cents = run.costMicroUsd / 10_000;
  const total = result.clauses.length + result.unverifiedQuotes;

  const figures = [
    { label: t('model'), value: modelKey ? t(MODEL_MESSAGE[modelKey]) : run.modelId },
    { label: t('promptVersion'), value: run.promptVersion },
    {
      label: t('tokens'),
      value: `${format.number(run.inputTokens)} / ${format.number(run.outputTokens)}`,
    },
    {
      label: t('cost'),
      value: t('costValue', {
        cents: format.number(cents, { maximumSignificantDigits: 2 }),
      }),
    },
    {
      label: t('duration'),
      value: t('durationValue', {
        seconds: format.number(run.latencyMs / 1000, { maximumFractionDigits: 1 }),
      }),
    },
    {
      label: t('droppedQuotes'),
      value: t('droppedValue', { dropped: result.unverifiedQuotes, total }),
    },
  ];

  return (
    <section aria-label={t('statsAria')} className={styles.stats}>
      <h3 className={styles.statsTitle}>{t('statsTitle')}</h3>
      <dl className={styles.figures}>
        {figures.map((figure) => (
          <div key={figure.label}>
            <dt className={styles.figureLabel}>{figure.label}</dt>
            <dd className={styles.figureValue}>{figure.value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.expires}>
        {t('expires', { date: format.dateTime(new Date(expiresAt), { dateStyle: 'long' }) })}
      </p>
      <Link href="/transparency" className={styles.allMetrics}>
        {t('allMetrics')}
      </Link>
    </section>
  );
}
