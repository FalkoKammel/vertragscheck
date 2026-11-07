import { Analysis } from '../../domain/analysis';

export interface GetsAnalysis {
  get(id: string): Promise<Analysis | undefined>;
}
