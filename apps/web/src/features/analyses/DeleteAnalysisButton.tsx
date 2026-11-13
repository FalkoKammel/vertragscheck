'use client';

import { Button, Group, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { deleteErrorKey, useDeleteAnalysis } from './useDeleteAnalysis';
import styles from './DeleteAnalysisButton.module.css';

interface Props {
  analysisId: string;
  deleteToken: string;
  onDeleted?: () => void;
  size?: 'xs' | 'sm';
}

export function DeleteAnalysisButton({ analysisId, deleteToken, onDeleted, size = 'sm' }: Props) {
  const t = useTranslations('Analyses');
  const [opened, { open, close }] = useDisclosure(false);
  const mutation = useDeleteAnalysis({ analysisId, deleteToken, onDeleted });

  const closeModal = () => {
    if (mutation.isPending) return;
    mutation.reset();
    close();
  };

  return (
    <>
      <Button variant="default" size={size} className={styles.trigger} onClick={open}>
        {t('delete')}
      </Button>
      <Modal opened={opened} onClose={closeModal} title={t('modalTitle')} centered>
        <p className={styles.text}>{t('modalText')}</p>
        {mutation.isError && (
          <p role="alert" className={styles.error}>
            {t(deleteErrorKey(mutation.error))}
          </p>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeModal} disabled={mutation.isPending}>
            {t('cancel')}
          </Button>
          <Button
            className={styles.danger}
            loading={mutation.isPending}
            onClick={() => {
              mutation.mutate();
            }}
          >
            {mutation.isPending ? t('deleting') : t('confirm')}
          </Button>
        </Group>
      </Modal>
    </>
  );
}
