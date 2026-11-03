'use client';

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useLocale, useTranslations } from 'next-intl';
import type { Ref } from 'react';
import styles from './TurnstileField.module.css';

interface TurnstileFieldProps {
  widgetRef: Ref<TurnstileInstance>;
  onToken: (token: string | null) => void;
}

export function TurnstileField({ widgetRef, onToken }: TurnstileFieldProps) {
  const t = useTranslations('Upload');
  const locale = useLocale();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    return (
      <p role="alert" className={styles.missing}>
        {t('captchaMissing')}
      </p>
    );
  }

  return (
    <div role="group" aria-label={t('captchaAria')} className={styles.field}>
      <Turnstile
        ref={widgetRef}
        siteKey={siteKey}
        options={{ language: locale, theme: 'light' }}
        onSuccess={onToken}
        onExpire={() => {
          onToken(null);
        }}
        onError={() => {
          onToken(null);
        }}
      />
    </div>
  );
}
