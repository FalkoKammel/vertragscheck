import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { DataStack } from '../lib/data-stack.js';

let template: Template;

beforeAll(() => {
  const stack = new DataStack(new App(), 'Test', {
    env: { account: '123456789012', region: 'eu-central-1' },
  });
  template = Template.fromStack(stack);
});

describe('DataStack table', () => {
  it('is on-demand with string PK/SK and TTL on "ttl"', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false },
    });
  });

  it('has GSI1 on GSI1PK/GSI1SK', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: [
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
        }),
      ],
      AttributeDefinitions: Match.arrayWith([
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
      ]),
    });
  });
});

describe('DataStack bucket', () => {
  it('blocks public access and is encrypted', () => {
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
      OwnershipControls: { Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }] },
    });
  });

  it('denies requests without TLS', () => {
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Action: 's3:*',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
  });

  it('expires uploads/ after one day and nothing else', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: [
          Match.objectLike({
            Id: 'ExpireUploads',
            Prefix: 'uploads/',
            ExpirationInDays: 1,
            Status: 'Enabled',
          }),
        ],
      },
    });
  });

  it('allows only POST from CloudFront and localhost', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
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

describe('DataStack retention', () => {
  it('retains the table and the bucket', () => {
    for (const type of ['AWS::DynamoDB::Table', 'AWS::S3::Bucket']) {
      const resources = Object.values(template.findResources(type));
      expect(resources).toHaveLength(1);
      expect(resources[0]).toMatchObject({
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    }
  });

  it('has no auto-delete custom resource', () => {
    template.resourceCountIs('Custom::S3AutoDeleteObjects', 0);
  });
});
