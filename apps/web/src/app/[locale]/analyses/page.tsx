import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AnalysesList } from '@/features/analyses/AnalysesList';
import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('analyses'), robots: { index: false } };
}

export default async function AnalysesPage() {
  const t = await getTranslations('Analyses');

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t('title')}</h1>
      <p className={styles.intro}>{t('intro')}</p>
      <AnalysesList />
    </main>
  );
}
