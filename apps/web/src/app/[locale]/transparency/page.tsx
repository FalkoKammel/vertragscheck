import { TableTbody, TableTd, TableTh, TableThead, TableTr, Table } from '@mantine/core';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import styles from './page.module.css';

const REPO_URL = 'https://github.com/FalkoKammel/vertragscheck';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('transparency') };
}

export default async function TransparencyPage() {
  const t = await getTranslations('Transparency');
  const empty = t('empty');

  const metrics = [
    { label: t('analysesLabel'), hint: null },
    { label: t('costLabel'), hint: null },
    { label: t('durationLabel'), hint: null },
    { label: t('droppedLabel'), hint: t('droppedHint') },
  ];
  const rules = [t('budgetRule1'), t('budgetRule2'), t('budgetRule3')];
  const columns = [t('colModel'), t('colFound'), t('colFalse'), t('colCost'), t('colDuration')];
  const values = [empty, empty, empty, empty];

  return (
    <main className={styles.main}>
      <div className={styles.intro}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </div>

      <section aria-label={t('metricsAria')} className={styles.metrics}>
        {metrics.map((metric) => (
          <div key={metric.label} className={styles.tile}>
            <div className={styles.tileLabel}>{metric.label}</div>
            <div className={styles.tileValue}>{empty}</div>
            {metric.hint ? <div className={styles.tileHint}>{metric.hint}</div> : null}
          </div>
        ))}
      </section>

      <section aria-label={t('budgetAria')} className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('budgetTitle')}</h2>
        <div className={styles.track} aria-hidden="true">
          <div className={styles.bar} />
        </div>
        <ul className={styles.rules}>
          {rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section aria-label={t('modelsAria')} className={styles.panel}>
        <div className={styles.panelHead}>
          <h2 className={styles.panelTitle}>{t('modelsTitle')}</h2>
          <p className={styles.panelLead}>{t('modelsLead')}</p>
        </div>
        <div className={styles.tableWrap}>
          <Table className={styles.table}>
            <TableThead>
              <TableTr>
                {columns.map((column) => (
                  <TableTh key={column}>{column}</TableTh>
                ))}
              </TableTr>
            </TableThead>
            <TableTbody>
              <TableTr>
                <TableTd className={styles.modelName}>
                  {t('haiku45')} <span className={styles.badge}>{t('active')}</span>
                </TableTd>
                {values.map((value, index) => (
                  <TableTd key={index}>{value}</TableTd>
                ))}
              </TableTr>
              <TableTr>
                <TableTd className={styles.modelName}>{t('sonnet')}</TableTd>
                {values.map((value, index) => (
                  <TableTd key={index}>{value}</TableTd>
                ))}
              </TableTr>
              <TableTr>
                <TableTd className={styles.modelName}>
                  {t('haiku55')} <span className={styles.hint}>{t('quotaRequested')}</span>
                </TableTd>
                {values.map((value, index) => (
                  <TableTd key={index}>{value}</TableTd>
                ))}
              </TableTr>
            </TableTbody>
          </Table>
        </div>
      </section>

      <p className={styles.readme}>
        {t('readmeBefore')}{' '}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          {t('readmeLink')}
        </a>
        {t('readmeAfter')}
      </p>
    </main>
  );
}
