import { Button, Checkbox, NativeSelect } from '@mantine/core';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import styles from './page.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('upload') };
}

export default async function UploadPage() {
  const t = await getTranslations('Upload');

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>{t('title')}</h1>

        <NativeSelect
          id="vertragsart"
          label={t('typeLabel')}
          data={[
            { value: 'rental', label: t('typeRental') },
            { value: 'employment', label: t('typeEmployment') },
          ]}
          size="md"
        />

        <div className={styles.field}>
          <label htmlFor="datei" className={styles.label}>
            {t('fileLabel')}
          </label>
          <div className={styles.dropzone}>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              className={styles.dropIcon}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V4" />
              <path d="M7 9l5-5 5 5" />
              <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
            </svg>
            <div className={styles.dropTitle}>{t('dropTitle')}</div>
            <div className={styles.dropHint}>{t('dropHint')}</div>
            <input id="datei" type="file" accept="application/pdf" className={styles.file} />
          </div>
        </div>

        <Checkbox id="hinweis" label={t('consent')} />

        <div className={styles.captcha}>{t('captcha')}</div>

        <Button type="button" size="md" h={48} fw={600}>
          {t('submit')}
        </Button>

        <p className={styles.note}>{t('limitNote')}</p>
      </section>
    </main>
  );
}
