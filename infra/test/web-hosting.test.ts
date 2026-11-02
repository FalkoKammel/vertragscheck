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
  // Tests assert on the template only, so skip the esbuild bundling of the Lambda code.
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
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
        Origins: Match.arrayWith([
          Match.objectLike({
            OriginAccessControlId: Match.anyValue(),
            S3OriginConfig: { OriginAccessIdentity: '' },
          }),
        ]),
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
        CacheBehaviors: Match.arrayWith([Match.objectLike({ PathPattern: '/_next/static/*' })]),
      },
    });
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: Match.objectLike({ DefaultTTL: 31536000, MinTTL: 31536000 }),
    });
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: Match.objectLike({ DefaultTTL: 60, MinTTL: 0 }),
    });
  });

  it('has no distribution-wide custom error responses, they would also hit /api/*', () => {
    const [dist] = Object.values(template.findResources('AWS::CloudFront::Distribution'));
    const config = (dist?.Properties as { DistributionConfig: Record<string, unknown> })
      .DistributionConfig;
    expect(config).not.toHaveProperty('CustomErrorResponses');
  });

  it('runs the URL rewrite function on the default behavior only', () => {
    const [dist] = Object.values(template.findResources('AWS::CloudFront::Distribution'));
    const config = (
      dist?.Properties as {
        DistributionConfig: { CacheBehaviors: Record<string, unknown>[] };
      }
    ).DistributionConfig;
    for (const behavior of config.CacheBehaviors) {
      expect(behavior).not.toHaveProperty('FunctionAssociations');
    }
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
