export type AnalysisStatus = 'pending_upload' | 'running' | 'done' | 'failed';
export type ContractType = 'rental' | 'employment';
export type Language = 'de' | 'en';

export interface Analysis {
  id: string;
  status: AnalysisStatus;
  contractType: ContractType;
  language: Language;
  createdAt: Date;
  expiresAt: Date;
  deleteTokenHash: string;
}
