import { Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { WebHosting } from './constructs/web-hosting.js';

export interface AppStackProps extends StackProps {
  /** Directory with the Next.js static export (apps/web/out). */
  readonly webAssetPath: string;
}

export class AppStack extends Stack {
  readonly web: WebHosting;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.web = new WebHosting(this, 'Web', { assetPath: props.webAssetPath });
  }
}
