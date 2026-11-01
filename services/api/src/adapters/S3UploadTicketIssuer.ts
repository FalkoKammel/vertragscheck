import type { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { IssuesTicket, UploadTicket } from '../application/adapters/IssuesTicket';

export class S3UploadTicketIssuer implements IssuesTicket {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async issue(params: {
    key: string;
    maxBytes: number;
    expiresInSeconds: number;
  }): Promise<UploadTicket> {
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: params.key,
      Expires: params.expiresInSeconds,
      Fields: { 'Content-Type': 'application/pdf' },
      Conditions: [
        ['content-length-range', 1, params.maxBytes],
        ['eq', '$Content-Type', 'application/pdf'],
      ],
    });
    return { url, fields };
  }
}
