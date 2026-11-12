import axios from 'axios';
import { z } from 'zod';
import type { VerifiesCaptcha } from '../application/adapters/VerifiesCaptcha';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const siteverifyResponse = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
});

export class TurnstileCaptchaVerifier implements VerifiesCaptcha {
  constructor(
    private readonly secret: string,
    private readonly expectedHostname: string,
  ) {}

  async verify(captchaToken: string, clientIp: string): Promise<boolean> {
    let data: unknown;
    try {
      const res = await axios.post<unknown>(
        SITEVERIFY_URL,
        { secret: this.secret, response: captchaToken, remoteip: clientIp },
        { timeout: 5000 },
      );
      data = res.data;
    } catch (err: unknown) {
      return this.reject('request_failed', { error: err instanceof Error ? err.name : 'unknown' });
    }

    const parsed = siteverifyResponse.safeParse(data);
    if (!parsed.success) return this.reject('unexpected_response');
    if (!parsed.data.success) {
      return this.reject('rejected_by_cloudflare', { errorCodes: parsed.data['error-codes'] });
    }
    if (parsed.data.hostname !== this.expectedHostname) {
      // Both values are site hostnames from Cloudflare and our config, not user data.
      return this.reject('hostname_mismatch', {
        received: parsed.data.hostname,
        expected: this.expectedHostname,
      });
    }
    return true;
  }

  // Fail closed. Logs only a reason and Cloudflare's error codes: never the token, the secret or the IP.
  private reject(reason: string, details: Record<string, unknown> = {}): false {
    console.warn({ msg: 'captcha rejected', reason, ...details });
    return false;
  }
}
