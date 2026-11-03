import { NetworkError, S3UploadError } from './errors';
import type { UploadTicket } from './uploads';

export function uploadToS3(
  ticket: UploadTicket,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', ticket.url);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new S3UploadError(xhr.status));
      }
    });
    xhr.addEventListener('error', () => {
      reject(new NetworkError());
    });
    xhr.addEventListener('abort', () => {
      reject(new NetworkError());
    });
    xhr.send(form);
  });
}
