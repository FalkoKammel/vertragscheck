export interface VerifiesCaptcha {
  verify(captchaToken: string, clientIp: string): Promise<boolean>;
}
