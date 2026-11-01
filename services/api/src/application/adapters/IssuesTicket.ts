export interface UploadTicket {
  url: string;
  fields: Record<string, string>;
}

export interface IssuesTicket {
  issue(params: { key: string; maxBytes: number; expiresInSeconds: number }): Promise<UploadTicket>;
}
