import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TransparencyView } from '@/features/transparency/TransparencyView';
import styles from './page.module.css';

const REPO_URL = 'https://github.com/FalkoKammel/vertragscheck';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('transparency') };
}

export default async function TransparencyPage() {
  const t = await getTranslations('Transparency');

  return (
    <main className={styles.main}>
      <div className={styles.intro}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </div>

      <TransparencyView />

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
