'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteAnalysis } from '@/lib/api/deleteAnalysis';
import { ApiError } from '@/lib/api/errors';
import { removeStoredAnalysis } from '../upload/storage';

interface Options {
  analysisId: string;
  deleteToken: string;
  onDeleted?: () => void;
}

export type DeleteErrorKey = 'invalidToken' | 'failed';

export function deleteErrorKey(error: unknown): DeleteErrorKey {
  return error instanceof ApiError && error.status === 403 ? 'invalidToken' : 'failed';
}

export function useDeleteAnalysis({ analysisId, deleteToken, onDeleted }: Options) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await deleteAnalysis(analysisId, deleteToken);
      } catch (error) {
        // Already gone (deleted elsewhere or expired): the goal is reached.
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
    },
    onSuccess: () => {
      removeStoredAnalysis(analysisId);
      queryClient.removeQueries({ queryKey: ['analysis', analysisId] });
      onDeleted?.();
    },
  });
}
