'use client';

import { useId, useRef, useState, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import { cx } from '@/lib/cx';
import { validateFile, type FileProblem } from './validateFile';
import styles from './FileDropzone.module.css';

interface FileDropzoneProps {
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}

export function FileDropzone({ file, disabled, onChange }: FileDropzoneProps) {
  const t = useTranslations('Upload');
  const inputId = useId();
  const problemId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<FileProblem | null>(null);

  function select(candidate: File | undefined) {
    if (!candidate) return;
    const result = validateFile(candidate);
    setProblem(result.ok ? null : result.problem);
    onChange(result.ok ? candidate : null);
    // Allows choosing the same file again after fixing it.
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) select(event.dataTransfer.files[0]);
  }

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {t('fileLabel')}
      </label>
      <div
        className={cx(styles.dropzone, dragging && styles.dragging)}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          className={styles.icon}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 16V4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <div className={styles.title}>{t('dropTitle')}</div>
        <div className={styles.hint}>{t('dropHint')}</div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf"
          disabled={disabled}
          aria-invalid={problem !== null}
          aria-describedby={problem ? problemId : undefined}
          className={styles.input}
          onChange={(event) => {
            select(event.target.files?.[0]);
          }}
        />
        {file ? (
          <div className={styles.selected}>
            {t('fileSelected', {
              name: file.name,
              size: (file.size / (1024 * 1024)).toFixed(1),
            })}
          </div>
        ) : null}
      </div>
      {problem ? (
        <p id={problemId} role="alert" className={styles.problem}>
          {t(`fileProblem.${problem}`)}
        </p>
      ) : null}
    </div>
  );
}
