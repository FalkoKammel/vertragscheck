import { join } from 'node:path';
import { Duration, Stack } from 'aws-cdk-lib';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket, EventType, type IBucket } from 'aws-cdk-lib/aws-s3';
import { SqsDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export const DEFAULT_MODEL_ID = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0';
export const DEFAULT_PROMPT_VERSION = 'v1';

export const MAX_CONCURRENCY = 2;
export const ANALYSIS_TIMEOUT = Duration.minutes(2);

export interface AnalysisProps {
  readonly table: ITable;
  readonly bucket: IBucket;
  readonly budgetLimitMicroUsd: number;
  readonly modelId?: string;
  readonly promptVersion?: string;
}

export class Analysis extends Construct {
  readonly function: NodejsFunction;
  readonly queue: Queue;
  readonly deadLetterQueue: Queue;

  constructor(scope: Construct, id: string, props: AnalysisProps) {
    super(scope, id);
    const stack = Stack.of(this);
    const modelId = props.modelId ?? DEFAULT_MODEL_ID;

    this.deadLetterQueue = new Queue(this, 'DeadLetterQueue', {
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });
    this.queue = new Queue(this, 'Queue', {
      // Must be at least the function timeout; 6x is the AWS recommendation.
      visibilityTimeout: Duration.seconds(ANALYSIS_TIMEOUT.toSeconds() * 6),
      enforceSSL: true,
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount: 3 },
    });

    // Re-import the bucket so the notification resources are created in this stack.
    // Adding the notification to DataStack's bucket would make DataStack depend on the
    // queue here, while this stack already depends on DataStack (circular).
    const uploads = Bucket.fromBucketAttributes(this, 'Uploads', {
      bucketArn: props.bucket.bucketArn,
      bucketName: props.bucket.bucketName,
    });
    uploads.addEventNotification(EventType.OBJECT_CREATED, new SqsDestination(this.queue), {
      prefix: 'uploads/',
      suffix: '.pdf',
    });

    this.function = new NodejsFunction(this, 'Function', {
      entry: join(import.meta.dirname, '../../../services/api/src/handlers/AnalysisHandler.ts'),
      handler: 'analysisHandler',
      projectRoot: join(import.meta.dirname, '../../..'),
      depsLockFilePath: join(import.meta.dirname, '../../../pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 1024,
      timeout: ANALYSIS_TIMEOUT,
      logGroup: new LogGroup(this, 'LogGroup', { retention: RetentionDays.TWO_WEEKS }),
      environment: {
        TABLE_NAME: props.table.tableName,
        UPLOAD_BUCKET: props.bucket.bucketName,
        MODEL_ID: modelId,
        PROMPT_VERSION: props.promptVersion ?? DEFAULT_PROMPT_VERSION,
        BUDGET_LIMIT_MICRO_USD: String(props.budgetLimitMicroUsd),
      },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node24',
        externalModules: [],
        minify: true,
        sourceMap: true,
        banner:
          "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });
    this.function.addEventSource(
      new SqsEventSource(this.queue, {
        batchSize: 1,
        // Caps parallel invocations at the queue. Reserved concurrency would do the same, but
        // AWS requires 10 unreserved executions and a new account's quota is only 10.
        maxConcurrency: MAX_CONCURRENCY,
      }),
    );

    props.table.grantReadWriteData(this.function);
    this.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:GetObject', 's3:DeleteObject'],
        resources: [props.bucket.arnForObjects('uploads/*')],
      }),
    );
    this.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:PutObject'],
        resources: [props.bucket.arnForObjects('texts/*')],
      }),
    );

    // Converse on an inference profile needs two statements: the profile itself (in our
    // region) and the foundation model in whichever EU region the profile routes to. The
    // second is allowed in all eu-* regions but only when the call comes through our profile,
    // so the region list never has to be maintained. The id is used as given, with or without
    // a date/version suffix (e.g. eu.anthropic.claude-sonnet-4-6).
    const baseModelId = modelId.replace(/^[a-z]+\./, '');
    const profileArn = stack.formatArn({
      service: 'bedrock',
      resource: 'inference-profile',
      resourceName: modelId,
    });
    this.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [profileArn],
      }),
    );
    this.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:${stack.partition}:bedrock:eu-*::foundation-model/${baseModelId}`],
        conditions: { StringEquals: { 'bedrock:InferenceProfileArn': profileArn } },
      }),
    );
  }
}
