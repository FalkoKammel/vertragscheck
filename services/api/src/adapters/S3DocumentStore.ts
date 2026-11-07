import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { DeletesPdf } from '../application/adapters/DeletesPdf';
import type { GetsPdfFile } from '../application/adapters/GetsPdfFile';
import type { PutsText } from '../application/adapters/PutsText';

export class S3DocumentStore implements GetsPdfFile, PutsText, DeletesPdf {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async getPdf(key: string): Promise<Uint8Array> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) throw new Error('S3 object has no body');
    return res.Body.transformToByteArray();
  }

  async putText(analysisId: string, text: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `texts/${analysisId}.txt`,
        Body: text,
        ContentType: 'text/plain; charset=utf-8',
      }),
    );
  }

  async deletePdf(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
