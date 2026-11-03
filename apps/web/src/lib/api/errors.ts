/** The API answered with an error body `{ code }` (or with something we cannot read). */
export class ApiError extends Error {
  constructor(readonly code: string) {
    super(`API error ${code}`);
    this.name = 'ApiError';
  }
}

/** The request never got an answer (offline, DNS, CORS, aborted connection). */
export class NetworkError extends Error {
  constructor() {
    super('Network error');
    this.name = 'NetworkError';
  }
}

/** S3 rejected the upload, for example because the presigned POST expired or a condition failed. */
export class S3UploadError extends Error {
  constructor(readonly status: number) {
    super(`S3 upload failed with status ${String(status)}`);
    this.name = 'S3UploadError';
  }
}
