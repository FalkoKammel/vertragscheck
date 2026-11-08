import { NoSuchKey, type S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { S3DocumentStore } from './S3DocumentStore';

function fakeS3(body?: Uint8Array, error?: Error) {
  const sent: { constructor: { name: string }; input: Record<string, unknown> }[] = [];
  const s3 = {
    send: (command: (typeof sent)[number]) => {
      sent.push(command);
      if (error) return Promise.reject(error);
      return Promise.resolve({
        Body: body
          ? {
              transformToByteArray: () => Promise.resolve(body),
              transformToString: () => Promise.resolve(new TextDecoder().decode(body)),
            }
          : undefined,
      });
    },
  } as unknown as S3Client;
  return { sent, store: new S3DocumentStore(s3, 'bucket') };
}

describe('S3DocumentStore', () => {
  it('reads the PDF bytes', async () => {
    const { sent, store } = fakeS3(new Uint8Array([1, 2, 3]));
    expect(await store.getPdf('uploads/a1.pdf')).toEqual(new Uint8Array([1, 2, 3]));
    expect(sent[0]?.input).toEqual({ Bucket: 'bucket', Key: 'uploads/a1.pdf' });
  });

  it('throws when the object has no body', async () => {
    await expect(fakeS3().store.getPdf('uploads/a1.pdf')).rejects.toThrow();
  });

  it('reads the text from texts/<id>.txt', async () => {
    const { sent, store } = fakeS3(new TextEncoder().encode('Müller'));
    expect(await store.getText('a1')).toBe('Müller');
    expect(sent[0]?.constructor.name).toBe('GetObjectCommand');
    expect(sent[0]?.input).toEqual({ Bucket: 'bucket', Key: 'texts/a1.txt' });
  });

  it('returns undefined when the text does not exist', async () => {
    const missing = new NoSuchKey({ message: 'no', $metadata: {} });
    expect(await fakeS3(undefined, missing).store.getText('a1')).toBeUndefined();
  });

  it('rethrows other errors when reading the text', async () => {
    await expect(fakeS3(undefined, new Error('denied')).store.getText('a1')).rejects.toThrow(
      'denied',
    );
  });

  it('writes the text to texts/<id>.txt as UTF-8', async () => {
    const { sent, store } = fakeS3();
    await store.putText('a1', 'Müller');
    expect(sent[0]?.constructor.name).toBe('PutObjectCommand');
    expect(sent[0]?.input).toEqual({
      Bucket: 'bucket',
      Key: 'texts/a1.txt',
      Body: 'Müller',
      ContentType: 'text/plain; charset=utf-8',
    });
  });

  it('deletes the PDF', async () => {
    const { sent, store } = fakeS3();
    await store.deletePdf('uploads/a1.pdf');
    expect(sent[0]?.constructor.name).toBe('DeleteObjectCommand');
    expect(sent[0]?.input).toEqual({ Bucket: 'bucket', Key: 'uploads/a1.pdf' });
  });
});
