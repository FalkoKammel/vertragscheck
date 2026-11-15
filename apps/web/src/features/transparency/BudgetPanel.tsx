import { useFormatter, useTranslations } from 'next-intl';
import { Progress, Skeleton } from '@mantine/core';
import type { StatsResponse } from '@/lib/api/getStats';
import styles from './TransparencyView.module.css';

interface Props {
  stats: StatsResponse | undefined | null;
}

export function BudgetPanel({ stats }: Props) {
  const t = useTranslations('Transparency');
  const format = useFormatter();
  const rules = [t('budgetRule1'), t('budgetRule2'), t('budgetRule3')];

  const usd = (micro: number) =>
    format.number(micro / 1_000_000, { style: 'currency', currency: 'USD' });
  const percent = stats
    ? Math.min(100, (stats.budget.spentMicroUsd / stats.budget.limitMicroUsd) * 100)
    : 0;

  return (
    <section aria-label={t('budgetAria')} className={styles.panel}>
      <div className={styles.panelTop}>
        <h2 className={styles.panelTitle}>{t('budgetTitle')}</h2>
        {stats ? (
          <span className={styles.spent}>
            {t('budgetSpent', {
              spent: usd(stats.budget.spentMicroUsd),
              limit: usd(stats.budget.limitMicroUsd),
            })}
          </span>
        ) : stats === undefined ? (
          <Skeleton height={20} width={140} />
        ) : null}
      </div>
      <Progress value={percent} size="md" radius="xl" aria-label={t('budgetProgressAria')} />
      <ul className={styles.rules}>
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </section>
  );
}
