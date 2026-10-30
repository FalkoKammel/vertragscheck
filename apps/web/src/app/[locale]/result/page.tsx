import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { cx } from '@/lib/cx';
import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('result'), robots: { index: false } };
}

export default async function ResultPage() {
  const t = await getTranslations('Result');
  const empty = t('empty');

  const figures = [
    { label: t('model'), value: empty },
    { label: t('promptVersion'), value: empty },
    { label: t('tokens'), value: empty },
    { label: t('cost'), value: empty },
    { label: t('duration'), value: empty },
    { label: t('droppedQuotes'), value: empty },
  ];

  return (
    <>
      <div className={styles.top}>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <div className={styles.meta}>{t('metaPlaceholder')}</div>
            <h1 className={styles.title}>{t('fileName')}</h1>
          </div>
          <div className={styles.pills}>
            <span className={cx(styles.pill, styles.critical)}>
              {t('critical', { count: empty })}
            </span>
            <span className={cx(styles.pill, styles.check)}>{t('check', { count: empty })}</span>
            <span className={cx(styles.pill, styles.fine)}>{t('fine', { count: empty })}</span>
          </div>
        </div>
        <div role="note" className={styles.note}>
          {t('note')}
        </div>
      </div>

      <main className={styles.main}>
        <article aria-label={t('textAria')} className={styles.text}>
          <div className={styles.textLabel}>{t('textLabel')}</div>
        </article>

        <aside aria-label={t('clausesAria')} className={styles.aside}>
          <h2 className={styles.asideTitle}>{t('clausesTitle')}</h2>

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
            <Link href="/transparency" className={styles.allMetrics}>
              {t('allMetrics')}
            </Link>
          </section>
        </aside>
      </main>
    </>
  );
}
