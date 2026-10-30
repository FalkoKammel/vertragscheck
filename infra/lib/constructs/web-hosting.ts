import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { urlRewriteCode } from './url-rewrite.js';

export interface WebHostingProps {
  /** Directory with the Next.js static export (apps/web/out). */
  readonly assetPath: string;
}

const cacheControl = (value: string) =>
  ({ header: 'Cache-Control', value, override: true }) as const;

export class WebHosting extends Construct {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: WebHostingProps) {
    super(scope, id);

    // Build artifact only, so it is safe to delete with the stack.
    this.bucket = new Bucket(this, 'Bucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const urlRewrite = new CloudFrontFunction(this, 'UrlRewrite', {
      code: FunctionCode.fromInline(urlRewriteCode),
      runtime: FunctionRuntime.JS_2_0,
    });

    const origin = S3BucketOrigin.withOriginAccessControl(this.bucket);

    const htmlCache = new CachePolicy(this, 'HtmlCache', {
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.minutes(1),
      maxTtl: Duration.minutes(5),
    });
    const htmlHeaders = new ResponseHeadersPolicy(this, 'HtmlHeaders', {
      customHeadersBehavior: {
        customHeaders: [cacheControl('public, max-age=60')],
      },
    });

    const assetCache = new CachePolicy(this, 'AssetCache', {
      minTtl: Duration.days(365),
      defaultTtl: Duration.days(365),
      maxTtl: Duration.days(365),
    });
    const assetHeaders = new ResponseHeadersPolicy(this, 'AssetHeaders', {
      customHeadersBehavior: {
        customHeaders: [cacheControl('public, max-age=31536000, immutable')],
      },
    });

    this.distribution = new Distribution(this, 'Distribution', {
      comment: 'Vertragscheck static site',
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: htmlCache,
        responseHeadersPolicy: htmlHeaders,
        functionAssociations: [
          { function: urlRewrite, eventType: FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        '/_next/static/*': {
          origin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: assetCache,
          responseHeadersPolicy: assetHeaders,
        },
      },
      // A private bucket answers 403 for missing keys.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 404,
        responsePagePath: '/404.html',
        ttl: Duration.seconds(10),
      })),
    });

    new BucketDeployment(this, 'Deployment', {
      sources: [Source.asset(props.assetPath)],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
    });

    new CfnOutput(this, 'Url', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront URL of the static site',
    });
  }
}
