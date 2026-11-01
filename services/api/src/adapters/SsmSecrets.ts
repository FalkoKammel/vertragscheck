import { GetParameterCommand, type SSMClient } from '@aws-sdk/client-ssm';

export class SsmSecrets {
  private readonly cache = new Map<string, Promise<string>>();

  constructor(private readonly ssm: SSMClient) {}

  get(name: string): Promise<string> {
    let value = this.cache.get(name);
    if (!value) {
      value = this.fetch(name);
      this.cache.set(name, value);
      value.catch(() => this.cache.delete(name));
    }
    return value;
  }

  private async fetch(name: string): Promise<string> {
    const res = await this.ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
    const value = res.Parameter?.Value;
    if (!value) throw new Error(`SSM parameter ${name} is empty`);
    return value;
  }
}
