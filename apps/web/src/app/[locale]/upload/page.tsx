import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { UploadForm } from '@/features/upload/UploadForm';
import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('upload') };
}

export default function UploadPage() {
  return (
    <main className={styles.main}>
      <UploadForm />
    </main>
  );
}
