'use client';

import { Button } from '@mantine/core';
import { useFormatter, useTranslations } from 'next-intl';
import { LinkButton } from '@/components/LinkButton';
import { Link } from '@/i18n/navigation';
import { removeStoredAnalysis, type StoredAnalysis } from '../upload/storage';
import { DeleteAnalysisButton } from './DeleteAnalysisButton';
import { useStoredAnalyses } from './useStoredAnalyses';
import styles from './AnalysesList.module.css';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function deletionDate(entry: StoredAnalysis): Date {
  return new Date(Date.parse(entry.createdAt) + RETENTION_MS);
}

export function isExpired(entry: StoredAnalysis, now: Date): boolean {
  return deletionDate(entry).getTime() <= now.getTime();
}

export function AnalysesList() {
  const t = useTranslations('Analyses');
  const tResult = useTranslations('Result');
  const format = useFormatter();
  const entries = useStoredAnalyses();

  if (entries === undefined) return <div className={styles.placeholder} aria-hidden="true" />;

  if (entries.length === 0) {
    return (
      <section className={styles.empty}>
        <p className={styles.emptyText}>{t('empty')}</p>
        <LinkButton href="/upload" size="md">
          {t('emptyAction')}
        </LinkButton>
      </section>
    );
  }

  const now = new Date();
  const date = (value: Date) => format.dateTime(value, { dateStyle: 'long' });

  return (
    <ul className={styles.list} aria-label={t('listAria')}>
      {entries.map((entry) => {
        const expired = isExpired(entry, now);
        const type =
          entry.contractType === 'rental'
            ? tResult('contractTypeRental')
            : tResult('contractTypeEmployment');
        return (
          <li key={entry.analysisId} className={styles.row}>
            <div className={styles.info}>
              <div className={styles.name}>{entry.fileName}</div>
              <div className={styles.meta}>
                {type} · {t('created', { date: date(new Date(entry.createdAt)) })}
              </div>
              <div className={expired ? styles.expired : styles.meta}>
                {expired ? t('expired') : t('deletesOn', { date: date(deletionDate(entry)) })}
              </div>
            </div>
            <div className={styles.actions}>
              {expired ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    removeStoredAnalysis(entry.analysisId);
                  }}
                >
                  {t('removeFromList')}
                </Button>
              ) : (
                <>
                  <Link
                    href={{ pathname: '/result', query: { id: entry.analysisId } }}
                    className={styles.open}
                  >
                    {t('open')}
                  </Link>
                  <DeleteAnalysisButton
                    analysisId={entry.analysisId}
                    deleteToken={entry.deleteToken}
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
