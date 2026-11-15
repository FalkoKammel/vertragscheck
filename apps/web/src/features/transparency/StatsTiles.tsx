import { useFormatter, useTranslations } from 'next-intl';
import { Skeleton } from '@mantine/core';
import type { StatsResponse } from '@/lib/api/getStats';
import styles from './TransparencyView.module.css';

const FEW_ANALYSES = 20;

interface Props {
  stats: StatsResponse | undefined | null;
}

export function StatsTiles({ stats }: Props) {
  const t = useTranslations('Transparency');
  const format = useFormatter();

  const done = stats?.analyses.done ?? 0;
  const failed = stats?.analyses.failed ?? 0;
  const hasData = stats ? done > 0 : false;
  const empty = t('empty');
  const sample = hasData && done < FEW_ANALYSES ? t('sampleSize', { count: done }) : null;

  const tiles = [
    {
      label: t('analysesLabel'),
      value: stats ? format.number(done) : empty,
      hints: [failed > 0 ? t('analysesFailed', { count: failed }) : null],
    },
    {
      label: t('costLabel'),
      value:
        hasData && stats?.meanCostMicroUsd != null
          ? t('costValue', {
              cents: format.number(stats.meanCostMicroUsd / 10_000, {
                maximumSignificantDigits: 2,
              }),
            })
          : empty,
      hints: [sample],
    },
    {
      label: t('durationLabel'),
      value:
        hasData && stats?.p95LatencyMs != null
          ? t('durationValue', {
              seconds: format.number(stats.p95LatencyMs / 1000, { maximumFractionDigits: 1 }),
            })
          : empty,
      hints: [sample],
    },
    {
      label: t('droppedLabel'),
      value:
        hasData && stats && stats.unverifiedQuotes.den > 0
          ? format.number(stats.unverifiedQuotes.num / stats.unverifiedQuotes.den, {
              style: 'percent',
              maximumFractionDigits: 1,
            })
          : empty,
      hints: [t('droppedHint'), sample],
    },
  ];

  return (
    <>
      <section aria-label={t('metricsAria')} className={styles.metrics}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <div className={styles.tileLabel}>{tile.label}</div>
            {stats === undefined ? (
              <Skeleton height={36} width="60%" />
            ) : (
              <div className={styles.tileValue}>{tile.value}</div>
            )}
            {stats !== undefined &&
              tile.hints.map((hint) =>
                hint ? (
                  <div key={hint} className={styles.tileHint}>
                    {hint}
                  </div>
                ) : null,
              )}
          </div>
        ))}
      </section>
      {stats === null && (
        <p role="status" className={styles.note}>
          {t('unavailable')}
        </p>
      )}
      {stats && !hasData && <p className={styles.note}>{t('noData')}</p>}
    </>
  );
}
