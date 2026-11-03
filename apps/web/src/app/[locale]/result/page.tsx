import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ProcessingState } from '@/features/result/ProcessingState';
import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('result'), robots: { index: false } };
}

export default function ResultPage() {
  return (
    <main className={styles.main}>
      <Suspense>
        <ProcessingState />
      </Suspense>
    </main>
  );
}
