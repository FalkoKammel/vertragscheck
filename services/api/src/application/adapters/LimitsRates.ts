export interface LimitsRates {
  tryConsume(clientIp: string, day: string, limit: number): Promise<boolean>;
}
