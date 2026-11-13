import { describe, expect, it, vi } from 'vitest';
import { deleteAnalysis } from './deleteAnalysis';
import { ApiError, NetworkError } from './errors';

describe('deleteAnalysis', () => {
  it('sends DELETE with the token in the Authorization header', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    await deleteAnalysis('a b', 'tok', fetchMock);
    expect(fetchMock).toHaveBeenCalledWith('/api/analyses/a%20b', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    });
  });

  it('throws an ApiError with code and status', async () => {
    const fetchMock = () =>
      Promise.resolve(Response.json({ code: 'INVALID_DELETE_TOKEN' }, { status: 403 }));
    const error = await deleteAnalysis('a1', 't', fetchMock).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INVALID_DELETE_TOKEN', status: 403 });
  });

  it('falls back to INTERNAL for an unreadable error body', async () => {
    const fetchMock = () => Promise.resolve(new Response('oops', { status: 502 }));
    await expect(deleteAnalysis('a1', 't', fetchMock)).rejects.toMatchObject({
      code: 'INTERNAL',
      status: 502,
    });
  });

  it('throws a NetworkError when the request fails', async () => {
    const fetchMock = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(deleteAnalysis('a1', 't', fetchMock)).rejects.toBeInstanceOf(NetworkError);
  });
});
