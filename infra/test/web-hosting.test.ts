import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppStack } from '../lib/app-stack.js';
import { DataStack } from '../lib/data-stack.js';

let template: Template;

beforeAll(() => {
  const webAssetPath = mkdtempSync(join(tmpdir(), 'vc-web-'));
  writeFileSync(join(webAssetPath, 'index.html'), '<html></html>');
  const app = new App();
  const env = { account: '123456789012', region: 'eu-central-1' };
  const data = new DataStack(app, 'TestData', { env });
  const stack = new AppStack(app, 'Test', {
    env,
    webAssetPath,
    table: data.table,
    bucket: data.bucket,
  });
  template = Template.fromStack(stack);
});

describe('WebHosting', () => {
  it('has a private, encrypted bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ],
      },
    });
  });

  it('only lets CloudFront read the bucket', () => {
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:GetObject',
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Condition: { StringEquals: { 'AWS:SourceArn': Match.anyValue() } },
          }),
        ]),
      },
    });
  });

  it('uses an origin access control, not an origin access identity', () => {
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template.resourceCountIs('AWS::CloudFront::CloudFrontOriginAccessIdentity', 0);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        Origins: [
          Match.objectLike({
            OriginAccessControlId: Match.anyValue(),
            S3OriginConfig: { OriginAccessIdentity: '' },
          }),
        ],
      },
    });
  });

  it('redirects to https and rewrites URLs with a viewer-request function', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
          FunctionAssociations: [Match.objectLike({ EventType: 'viewer-request' })],
        }),
      },
    });
    template.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionConfig: { Runtime: 'cloudfront-js-2.0' },
    });
  });

  it('caches /_next/static/* for a year and HTML for a minute', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: [Match.objectLike({ PathPattern: '/_next/static/*' })],
      },
    });
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: Match.objectLike({ DefaultTTL: 31536000, MinTTL: 31536000 }),
    });
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: Match.objectLike({ DefaultTTL: 60, MinTTL: 0 }),
    });
  });

  it('serves the exported 404 page for missing files', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 403, ResponseCode: 404, ResponsePagePath: '/404.html' }),
          Match.objectLike({ ErrorCode: 404, ResponseCode: 404, ResponsePagePath: '/404.html' }),
        ]),
      },
    });
  });

  it('deploys the export and invalidates the distribution', () => {
    template.hasResourceProperties('Custom::CDKBucketDeployment', {
      DistributionPaths: ['/*'],
      DistributionId: Match.anyValue(),
    });
  });

  it('outputs the CloudFront URL', () => {
    const outputs = template.findOutputs('*');
    expect(Object.keys(outputs)).toContainEqual(expect.stringContaining('Url'));
  });
});
