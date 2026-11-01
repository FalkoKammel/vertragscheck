import axios from 'axios';
import { z } from 'zod';
import type { VerifiesCaptcha } from '../application/adapters/VerifiesCaptcha';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const siteverifyResponse = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
});

export class TurnstileCaptchaVerifier implements VerifiesCaptcha {
  constructor(
    private readonly secret: string,
    private readonly expectedHostname: string,
  ) {}

  async verify(captchaToken: string, clientIp: string): Promise<boolean> {
    try {
      const res = await axios.post<unknown>(
        SITEVERIFY_URL,
        { secret: this.secret, response: captchaToken, remoteip: clientIp },
        { timeout: 5000 },
      );
      const parsed = siteverifyResponse.safeParse(res.data);
      return (
        parsed.success && parsed.data.success && parsed.data.hostname === this.expectedHostname
      );
    } catch {
      return false; // fail closed
    }
  }
}
