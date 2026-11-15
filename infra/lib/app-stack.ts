import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import {
  AllowedMethods,
  CachePolicy,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { Analysis, DEFAULT_MODEL_ID } from './constructs/analysis.js';
import { DEFAULT_BUDGET_LIMIT_MICRO_USD, UploadApi } from './constructs/upload-api.js';
import { WebHosting } from './constructs/web-hosting.js';

export interface AppStackProps extends StackProps {
  readonly webAssetPath: string;
  readonly table: ITable;
  /** Uploads and extracted texts (DataStack). */
  readonly bucket: IBucket;
  readonly budgetLimitMicroUsd?: number;
  readonly modelId?: string;
}

export class AppStack extends Stack {
  readonly web: WebHosting;
  readonly uploadApi: UploadApi;
  readonly analysis: Analysis;
  readonly table: ITable;
  readonly bucket: IBucket;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const modelId = props.modelId ?? DEFAULT_MODEL_ID;
    this.table = props.table;
    this.bucket = props.bucket;
    this.web = new WebHosting(this, 'Web', { assetPath: props.webAssetPath });
    this.uploadApi = new UploadApi(this, 'Api', {
      table: props.table,
      bucket: props.bucket,
      budgetLimitMicroUsd: props.budgetLimitMicroUsd ?? DEFAULT_BUDGET_LIMIT_MICRO_USD,
      modelId,
    });

    this.analysis = new Analysis(this, 'Analysis', {
      table: props.table,
      bucket: props.bucket,
      budgetLimitMicroUsd: props.budgetLimitMicroUsd ?? DEFAULT_BUDGET_LIMIT_MICRO_USD,
      modelId,
    });

    const apiOriginRequestPolicy = new OriginRequestPolicy(this, 'ApiOriginRequest', {
      headerBehavior: OriginRequestHeaderBehavior.allowList(
        'CloudFront-Viewer-Address',
        'Content-Type',
        'Accept',
      ),
      queryStringBehavior: OriginRequestQueryStringBehavior.all(),
      cookieBehavior: OriginRequestCookieBehavior.none(),
    });

    const statsOrigin = new HttpOrigin(this.uploadApi.originDomainName);
    this.web.distribution.addBehavior('/api/stats', statsOrigin, {
      viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
      cachePolicy: new CachePolicy(this, 'ApiStatsCache', {
        minTtl: Duration.seconds(0),
        defaultTtl: Duration.seconds(0),
        maxTtl: Duration.minutes(5),
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      }),
    });

    this.web.distribution.addBehavior('/api/*', new HttpOrigin(this.uploadApi.originDomainName), {
      viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: AllowedMethods.ALLOW_ALL,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      originRequestPolicy: apiOriginRequestPolicy,
    });
  }
}
