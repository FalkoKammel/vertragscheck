import { Stack, type StackProps } from 'aws-cdk-lib';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { WebHosting } from './constructs/web-hosting.js';

export interface AppStackProps extends StackProps {
  /** Directory with the Next.js static export (apps/web/out). */
  readonly webAssetPath: string;
  /** Analyses, budget and rate-limit items (DataStack). Not used yet. */
  readonly table: ITable;
  /** Uploads and extracted texts (DataStack). Not used yet. */
  readonly bucket: IBucket;
}

export class AppStack extends Stack {
  readonly web: WebHosting;
  readonly table: ITable;
  readonly bucket: IBucket;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    this.table = props.table;
    this.bucket = props.bucket;
    this.web = new WebHosting(this, 'Web', { assetPath: props.webAssetPath });
  }
}
