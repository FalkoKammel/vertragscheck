import { useRef, useState } from 'react';
import { requestUpload } from '../../lib/api/uploads';
import type { ContractType, Language } from '../../lib/api/uploads';
import { uploadToS3 } from '../../lib/api/s3-upload';
import { errorMessageKey, type UploadErrorKey } from './errorMessageKey';
import { saveAnalysis } from './storage';

export type UploadState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'uploading'; progress: number }
  | { status: 'done'; analysisId: string }
  | { status: 'error'; messageKey: UploadErrorKey };

export interface UploadParams {
  file: File;
  captchaToken: string;
  contractType: ContractType;
  language: Language;
}

export interface UploadDeps {
  requestUpload: typeof requestUpload;
  uploadToS3: typeof uploadToS3;
  saveAnalysis: typeof saveAnalysis;
  now: () => Date;
}

const defaultDeps: UploadDeps = { requestUpload, uploadToS3, saveAnalysis, now: () => new Date() };

interface UseUploadOptions {
  /** Called after every failed attempt; the form resets Turnstile here (tokens are single-use). */
  onError?: () => void;
  deps?: UploadDeps;
}

export function useUpload({ onError, deps = defaultDeps }: UseUploadOptions = {}) {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const busy = useRef(false);

  async function start({ file, captchaToken, contractType, language }: UploadParams) {
    if (busy.current) return;
    busy.current = true;
    setState({ status: 'requesting' });
    try {
      const { analysisId, deleteToken, uploadTicket } = await deps.requestUpload({
        captchaToken,
        contractType,
        language,
      });

      // Stored before the S3 upload so the delete token is never lost if the tab closes.
      deps.saveAnalysis({
        analysisId,
        deleteToken,
        fileName: file.name,
        contractType,
        createdAt: deps.now().toISOString(),
      });

      setState({ status: 'uploading', progress: 0 });
      await deps.uploadToS3(uploadTicket, file, (progress) => {
        setState({ status: 'uploading', progress });
      });
      setState({ status: 'done', analysisId });
    } catch (error: unknown) {
      setState({ status: 'error', messageKey: errorMessageKey(error) });
      onError?.();
    } finally {
      busy.current = false;
    }
  }

  return { state, start };
}
