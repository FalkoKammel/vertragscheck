import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LinkButton } from '@/components/LinkButton';
import { Link } from '@/i18n/navigation';
import { cx } from '@/lib/cx';
import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('start') };
}

export default async function StartPage() {
  const t = await getTranslations('Start');

  const steps = [
    { key: '1', title: t('step1Title'), text: t('step1Text') },
    { key: '2', title: t('step2Title'), text: t('step2Text') },
    { key: '3', title: t('step3Title'), text: t('step3Text') },
  ];
  const samples = [
    { id: 'sample-rental', title: t('sampleRental') },
    { id: 'sample-employment', title: t('sampleEmployment') },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>{t('eyebrow')}</p>
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.lead}>{t('lead')}</p>
          <div className={styles.actions}>
            <LinkButton
              href={{ pathname: '/result', query: { id: 'sample-rental' } }}
              size="md"
              h={48}
              px={22}
              fw={600}
            >
              {t('exampleCta')}
            </LinkButton>
            <LinkButton href="/upload" size="md" h={48} px={22} fw={600} variant="default">
              {t('ownCta')}
            </LinkButton>
          </div>
          <p className={styles.note}>{t('note')}</p>
        </div>

        <div className={styles.excerpt}>
          <div className={styles.excerptLabel}>{t('excerptLabel')}</div>
          <p className={styles.contract}>{t('excerptHeading')}</p>
          <p className={styles.contract}>
            {t('excerptBefore')} <mark className={styles.mark}>{t('excerptMark')}</mark>
            {t('excerptAfter')}
          </p>
          <div className={styles.excerptFooter}>
            <span className={styles.pill}>{t('excerptLevel')}</span>
            <div className={styles.reason}>{t('excerptReason')}</div>
          </div>
        </div>
      </section>

      <section id="so-gehts" className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('howTitle')}</h2>
        <div className={styles.steps}>
          {steps.map((step) => (
            <div key={step.key} className={styles.card}>
              <div className={styles.stepHead}>
                <span className={styles.stepNumber}>{step.key}</span>
                <span className={styles.cardTitle}>{step.title}</span>
              </div>
              <div className={styles.cardText}>{step.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('samplesTitle')}</h2>
        <div className={styles.samples}>
          {samples.map((sample) => (
            <Link
              key={sample.id}
              href={{ pathname: '/result', query: { id: sample.id } }}
              className={cx(styles.card, styles.sampleCard)}
            >
              <div className={styles.cardTitle}>{sample.title}</div>
              <div className={styles.viewLink}>{t('viewAnalysis')}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
