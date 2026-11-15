import { useFormatter, useTranslations } from 'next-intl';
import { Table, TableTbody, TableTd, TableTh, TableThead, TableTr } from '@mantine/core';
import { modelLabelKey } from '@/features/result/clauses';
import { modelComparison, type ModelRow } from './evalModels';
import styles from './TransparencyView.module.css';

const EVAL_DOC_URL = 'https://github.com/FalkoKammel/vertragscheck/blob/main/docs/eval.md';

const MODEL_MESSAGE = {
  haiku45Eu: 'modelHaiku45Eu',
  haiku45: 'modelHaiku45',
  sonnet46Eu: 'modelSonnet46Eu',
} as const;

interface Props {
  activeModelId: string | undefined;
}

export function ModelTable({ activeModelId }: Props) {
  const t = useTranslations('Transparency');
  const tResult = useTranslations('Result');
  const format = useFormatter();
  const columns = [t('colModel'), t('colFound'), t('colFalse'), t('colCost'), t('colDuration')];

  const name = (row: ModelRow) => {
    const key = modelLabelKey(row.modelId);
    return key ? tResult(MODEL_MESSAGE[key]) : row.modelId;
  };

  return (
    <section aria-label={t('modelsAria')} className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{t('modelsTitle')}</h2>
        <p className={styles.panelLead}>{t('modelsLead', { count: modelComparison.contracts })}</p>
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
            {modelComparison.rows.map((row) => (
              <TableTr key={row.modelId}>
                <TableTd className={styles.modelName}>
                  {name(row)}
                  {row.modelId === activeModelId && (
                    <span className={styles.badge}>{t('active')}</span>
                  )}
                  <span className={styles.hint}>
                    {t('promptVersion', { version: row.promptVersion })}
                  </span>
                </TableTd>
                <TableTd>
                  {row.found.num}/{row.found.den}
                </TableTd>
                <TableTd>
                  {row.falseAlarms.num}/{row.falseAlarms.den}
                </TableTd>
                <TableTd>
                  {t('costValue', {
                    cents: format.number(row.meanCostMicroUsd / 10_000, {
                      maximumSignificantDigits: 2,
                    }),
                  })}
                </TableTd>
                <TableTd>
                  {t('durationValue', {
                    seconds: format.number(row.p95LatencyMs / 1000, { maximumFractionDigits: 1 }),
                  })}
                </TableTd>
              </TableTr>
            ))}
          </TableTbody>
        </Table>
      </div>
      <a className={styles.docLink} href={EVAL_DOC_URL} target="_blank" rel="noopener noreferrer">
        {t('evalDocLink')}
      </a>
    </section>
  );
}
