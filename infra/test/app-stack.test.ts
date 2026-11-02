import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppStack } from '../lib/app-stack.js';
import { DataStack } from '../lib/data-stack.js';

const env = { account: '123456789012', region: 'eu-central-1' };
let template: Template;
let dataTemplate: Template;

beforeAll(() => {
  const webAssetPath = mkdtempSync(join(tmpdir(), 'web-'));
  writeFileSync(join(webAssetPath, 'index.html'), '<html></html>');
  // Tests assert on the template only, so skip the esbuild bundling of the Lambda code.
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const data = new DataStack(app, 'Data', { env });
  const stack = new AppStack(app, 'App', {
    env,
    webAssetPath,
    table: data.table,
    bucket: data.bucket,
  });
  template = Template.fromStack(stack);
  dataTemplate = Template.fromStack(data);
}, 120_000);

/** Statements of the router Lambda's role policy only (not the BucketDeployment's). */
const statements = (): Record<string, unknown>[] =>
  Object.values(template.findResources('AWS::IAM::Policy'))
    .filter((r) => JSON.stringify(r.Properties).includes('ApiRouterServiceRole'))
    .flatMap(
      (r) =>
        (r.Properties as { PolicyDocument: { Statement: Record<string, unknown>[] } })
          .PolicyDocument.Statement,
    );

describe('router Lambda', () => {
  it('runs on Node 24 / arm64 with the expected environment', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Environment: {
        Variables: Match.objectLike({
          BUDGET_LIMIT_MICRO_USD: '10000000',
          IP_HASH_SECRET_PARAM: '/vertragscheck/ip-hash-secret',
          TURNSTILE_SECRET_PARAM: '/vertragscheck/turnstile-secret',
          SITE_HOSTNAME_PARAM: '/vertragscheck/site-hostname',
          TABLE_NAME: Match.anyValue(),
          UPLOAD_BUCKET: Match.anyValue(),
        }),
      },
      LoggingConfig: Match.objectLike({ LogGroup: Match.anyValue() }),
    });
  });

  it('has its own log group with 14 days retention', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 14 });
  });
});

describe('least privilege', () => {
  it('limits S3 writes to uploads/*', () => {
    const s3 = statements().filter((s) => JSON.stringify(s.Action).includes('s3:'));
    expect(s3).toHaveLength(1);
    expect(s3[0]?.Action).toBe('s3:PutObject');
    expect(JSON.stringify(s3[0]?.Resource)).toContain('/uploads/*');
  });

  it('grants DynamoDB read/write on the table, without wildcard resources', () => {
    const ddb = statements().filter((s) => JSON.stringify(s.Action).includes('dynamodb:'));
    expect(JSON.stringify(ddb.map((s) => s.Action))).toContain('dynamodb:PutItem');
    for (const s of ddb) {
      const resources = JSON.stringify(s.Resource);
      expect(resources).not.toContain('"*"');
      expect(resources).toContain('Fn::ImportValue');
    }
  });

  it('reads exactly the three SSM parameters', () => {
    const ssm = statements().filter((s) => JSON.stringify(s.Action).includes('ssm:'));
    expect(ssm).toHaveLength(1);
    expect(ssm[0]?.Action).toBe('ssm:GetParameter');
    const arns = JSON.stringify(ssm[0]?.Resource);
    for (const name of ['ip-hash-secret', 'turnstile-secret', 'site-hostname']) {
      expect(arns).toContain(`parameter/vertragscheck/${name}`);
    }
    expect((ssm[0]?.Resource as unknown[]).length).toBe(3);
  });

  it('allows kms:Decrypt only via SSM for the two secret parameters', () => {
    const kms = statements().filter((s) => JSON.stringify(s.Action).includes('kms:'));
    expect(kms).toHaveLength(1);
    expect(kms[0]?.Action).toBe('kms:Decrypt');
    const condition = JSON.stringify(kms[0]?.Condition);
    expect(condition).toContain('ssm.eu-central-1.amazonaws.com');
    expect(condition).toContain('parameter/vertragscheck/ip-hash-secret');
    expect(condition).toContain('parameter/vertragscheck/turnstile-secret');
    expect(condition).not.toContain('site-hostname');
  });
});

describe('HTTP API', () => {
  it('routes POST /api/uploads to the Lambda', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'POST /api/uploads',
    });
    template.resourceCountIs('AWS::ApiGatewayV2::Route', 1);
  });

  it('throttles the stage', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      DefaultRouteSettings: { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
    });
  });
});

describe('CloudFront /api/*', () => {
  const behavior = () => {
    const [dist] = Object.values(template.findResources('AWS::CloudFront::Distribution'));
    const config = (dist?.Properties as { DistributionConfig: { CacheBehaviors: unknown[] } })
      .DistributionConfig;
    return config.CacheBehaviors.find(
      (b) => (b as { PathPattern: string }).PathPattern === '/api/*',
    ) as Record<string, unknown>;
  };

  it('allows all methods over HTTPS only', () => {
    expect(behavior()).toMatchObject({
      ViewerProtocolPolicy: 'https-only',
      AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
    });
  });

  it('uses the managed CachingDisabled policy', () => {
    expect(behavior().CachePolicyId).toBe('4135ea2d-6df8-44a3-9df3-4b5a84be39ad');
  });

  it('forwards the viewer address but not Host, cookies or the full header set', () => {
    template.hasResourceProperties('AWS::CloudFront::OriginRequestPolicy', {
      OriginRequestPolicyConfig: Match.objectLike({
        HeadersConfig: {
          HeaderBehavior: 'whitelist',
          Headers: ['CloudFront-Viewer-Address', 'Content-Type', 'Accept'],
        },
        CookiesConfig: { CookieBehavior: 'none' },
        QueryStringsConfig: { QueryStringBehavior: 'all' },
      }),
    });
  });
});

describe('uploads bucket CORS (DataStack)', () => {
  it('allows POST from CloudFront and localhost:3000 only', () => {
    dataTemplate.hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: {
        CorsRules: [
          Match.objectLike({
            AllowedMethods: ['POST'],
            AllowedOrigins: ['https://*.cloudfront.net', 'http://localhost:3000'],
          }),
        ],
      },
    });
  });
});
