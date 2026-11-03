import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ResultView } from '@/features/result/ResultView';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('result'), robots: { index: false } };
}

export default function ResultPage() {
  return (
    <Suspense>
      <ResultView />
    </Suspense>
  );
}
