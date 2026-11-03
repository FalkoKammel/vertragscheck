'use client';

import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { Alert, Button, Checkbox, NativeSelect } from '@mantine/core';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { useRouter } from '@/i18n/navigation';
import type { ContractType } from '../../lib/api/uploads';
import { FileDropzone } from './FileDropzone';
import { TurnstileField } from './TurnstileField';
import { useUpload } from './useUpload';
import styles from './UploadForm.module.css';

export function UploadForm() {
  const t = useTranslations('Upload');
  const locale = useLocale();
  const router = useRouter();

  const [contractType, setContractType] = useState<ContractType>('rental');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileInstance>(null);

  // A Turnstile token can only be used once, so the widget is reset after every failed attempt.
  function handleError() {
    setCaptchaToken(null);
    turnstile.current?.reset();
  }

  const { state, start } = useUpload({ onError: handleError });

  useEffect(() => {
    if (state.status === 'done') {
      router.push({ pathname: '/result', query: { id: state.analysisId } });
    }
  }, [state, router]);

  const busy =
    state.status === 'requesting' || state.status === 'uploading' || state.status === 'done';
  const canSubmit = file !== null && consent && captchaToken !== null && !busy;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !captchaToken || !canSubmit) return;
    void start({ file, captchaToken, contractType, language: locale });
  }

  return (
    <div className={styles.layout}>
      <section className={styles.card}>
        <h1 className={styles.title}>{t('title')}</h1>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <NativeSelect
            label={t('typeLabel')}
            value={contractType}
            disabled={busy}
            onChange={(event) => {
              setContractType(event.currentTarget.value as ContractType);
            }}
            data={[
              { value: 'rental', label: t('typeRental') },
              { value: 'employment', label: t('typeEmployment') },
            ]}
            size="md"
          />

          <FileDropzone file={file} disabled={busy} onChange={setFile} />

          <Checkbox
            label={t('consent')}
            checked={consent}
            disabled={busy}
            onChange={(event) => {
              setConsent(event.currentTarget.checked);
            }}
          />

          <TurnstileField widgetRef={turnstile} onToken={setCaptchaToken} />

          {state.status === 'error' ? (
            <Alert color="red" variant="light" title={t('errorTitle')} role="alert">
              {t(`errors.${state.messageKey}`)}
            </Alert>
          ) : null}

          <Button type="submit" size="md" h={48} fw={600} disabled={!canSubmit}>
            {t('submit')}
          </Button>

          <p className={styles.note}>{t('limitNote')}</p>
        </form>
      </section>

      {busy ? (
        <div className={styles.progress}>
          <AnalysisProgress
            heading="h2"
            phase={state.status === 'done' ? 'analyzing' : 'uploading'}
            uploadProgress={state.status === 'uploading' ? state.progress : 0}
            fileName={file?.name}
          />
        </div>
      ) : null}
    </div>
  );
}
