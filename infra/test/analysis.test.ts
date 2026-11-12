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

beforeAll(() => {
  const webAssetPath = mkdtempSync(join(tmpdir(), 'web-'));
  writeFileSync(join(webAssetPath, 'index.html'), '<html></html>');
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const data = new DataStack(app, 'Data', { env });
  const stack = new AppStack(app, 'App', {
    env,
    webAssetPath,
    table: data.table,
    bucket: data.bucket,
  });
  template = Template.fromStack(stack);
}, 120_000);

interface Statement {
  Action: string | string[];
  Resource: unknown;
  Condition?: unknown;
}

/** Statements of the analysis Lambda's role policy only. */
const statements = (): Statement[] =>
  Object.values(template.findResources('AWS::IAM::Policy'))
    .filter((r) => JSON.stringify(r.Properties).includes('AnalysisFunctionServiceRole'))
    .flatMap(
      (r) =>
        (r.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement,
    );

const actions = (s: Statement | undefined): string[] =>
  s === undefined ? [] : Array.isArray(s.Action) ? s.Action : [s.Action];
const withAction = (prefix: string): Statement[] =>
  statements().filter((s) => actions(s).some((a) => a.startsWith(prefix)));

describe('S3 event notification', () => {
  it('sends ObjectCreated for uploads/*.pdf to the queue, and nothing else', () => {
    template.hasResourceProperties('Custom::S3BucketNotifications', {
      NotificationConfiguration: {
        QueueConfigurations: [
          {
            Events: ['s3:ObjectCreated:*'],
            Filter: {
              Key: {
                FilterRules: [
                  { Name: 'suffix', Value: '.pdf' },
                  { Name: 'prefix', Value: 'uploads/' },
                ],
              },
            },
            QueueArn: Match.anyValue(),
          },
        ],
      },
    });
  });
});

describe('queues', () => {
  it('has a dead-letter queue with maxReceiveCount 3', () => {
    template.hasResourceProperties('AWS::SQS::Queue', {
      RedrivePolicy: { maxReceiveCount: 3, deadLetterTargetArn: Match.anyValue() },
    });
  });

  it('has a visibility timeout of 6x the Lambda timeout', () => {
    template.hasResourceProperties('AWS::SQS::Queue', { VisibilityTimeout: 720 });
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: { Variables: Match.objectLike({ PROMPT_VERSION: Match.anyValue() }) },
      Timeout: 120,
    });
  });

  it('lets only the uploads bucket send messages', () => {
    template.hasResourceProperties('AWS::SQS::QueuePolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { Service: 's3.amazonaws.com' },
            Condition: Match.objectLike({ ArnLike: Match.anyValue() }),
          }),
        ]),
      },
    });
  });
});

describe('analysis Lambda', () => {
  it('runs on Node 24 / arm64 with 1024 MB and 2 min', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      MemorySize: 1024,
      Timeout: 120,
      Environment: {
        Variables: {
          TABLE_NAME: Match.anyValue(),
          UPLOAD_BUCKET: Match.anyValue(),
          MODEL_ID: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
          PROMPT_VERSION: Match.anyValue(),
          BUDGET_LIMIT_MICRO_USD: '10000000',
        },
      },
    });
  });

  it('has its own log group and reads the queue with batch size 1', () => {
    template.resourceCountIs('AWS::Logs::LogGroup', 2);
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 1,
      ScalingConfig: { MaximumConcurrency: 2 },
    });
  });
});

describe('least privilege', () => {
  it('reads and deletes only uploads/*, writes only texts/*', () => {
    const s3 = withAction('s3:');
    expect(s3).toHaveLength(2);
    const read = s3.find((s) => actions(s).includes('s3:GetObject'));
    const write = s3.find((s) => actions(s).includes('s3:PutObject'));
    expect(actions(read).sort()).toEqual(['s3:DeleteObject', 's3:GetObject']);
    expect(JSON.stringify(read?.Resource)).toContain('/uploads/*');
    expect(JSON.stringify(read?.Resource)).not.toContain('texts');
    expect(actions(write)).toEqual(['s3:PutObject']);
    expect(JSON.stringify(write?.Resource)).toContain('/texts/*');
    expect(JSON.stringify(write?.Resource)).not.toContain('uploads');
  });

  it('grants DynamoDB on the table only', () => {
    const ddb = withAction('dynamodb:');
    expect(ddb.length).toBeGreaterThan(0);
    for (const s of ddb) expect(JSON.stringify(s.Resource)).not.toContain('"*"');
  });

  it('allows InvokeModel on the inference profile itself', () => {
    const bedrock = withAction('bedrock:');
    expect(bedrock).toHaveLength(2);
    const profile = bedrock.find((s) => s.Condition === undefined);
    expect(profile?.Action).toBe('bedrock:InvokeModel');
    expect(JSON.stringify(profile?.Resource)).toContain(
      'inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0',
    );
    expect(JSON.stringify(profile?.Resource)).not.toContain('foundation-model');
  });

  it('allows the foundation model in eu-* regions only via our inference profile', () => {
    const model = withAction('bedrock:').find((s) => s.Condition !== undefined);
    expect(model?.Action).toBe('bedrock:InvokeModel');
    expect(JSON.stringify(model?.Resource)).toContain(
      ':bedrock:eu-*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
    );
    const condition = JSON.stringify(model?.Condition);
    expect(condition).toContain('bedrock:InferenceProfileArn');
    expect(condition).toContain('inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0');
    expect(JSON.stringify(model)).not.toContain('us-east');
  });
});
