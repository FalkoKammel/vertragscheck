import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  ObjectOwnership,
} from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export const GSI1_NAME = 'GSI1';

/**
 * Origins that may POST uploads to the bucket. Any CloudFront domain is allowed
 * because the exact domain lives in AppStack, which depends on this stack
 * (see docs/decisions.md, 020). Replace it with the custom domain once there is one.
 */
export const DEFAULT_UPLOAD_ORIGINS: readonly string[] = [
  'https://*.cloudfront.net',
  'http://localhost:3000',
];

export interface DataStackProps extends StackProps {
  /** Origins allowed by the CORS rule of the uploads bucket. */
  readonly uploadOrigins?: readonly string[];
}

export class DataStack extends Stack {
  readonly table: Table;
  readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps = {}) {
    super(scope, id, props);

    this.table = new Table(this, 'Table', {
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: GSI1_NAME,
      partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
    });

    this.bucket = new Bucket(this, 'Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'ExpireUploads',
          prefix: 'uploads/',
          expiration: Duration.days(1),
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
      cors: [
        {
          allowedMethods: [HttpMethods.POST],
          allowedOrigins: [...(props.uploadOrigins ?? DEFAULT_UPLOAD_ORIGINS)],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });
  }
}
