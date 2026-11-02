import { join } from 'node:path';
import { ArnFormat, Duration, Fn, Stack } from 'aws-cdk-lib';
import { HttpApi, HttpMethod, HttpStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export const IP_HASH_SECRET_PARAM = '/vertragscheck/ip-hash-secret';
export const TURNSTILE_SECRET_PARAM = '/vertragscheck/turnstile-secret';
export const SITE_HOSTNAME_PARAM = '/vertragscheck/site-hostname';

export const DEFAULT_BUDGET_LIMIT_MICRO_USD = 10_000_000;

export interface UploadApiProps {
  readonly table: ITable;
  readonly bucket: IBucket;
  readonly budgetLimitMicroUsd: number;
  readonly throttlingRateLimit?: number;
  readonly throttlingBurstLimit?: number;
}

/** Router Lambda behind an HTTP API (`POST /api/uploads`), reached through CloudFront. */
export class UploadApi extends Construct {
  readonly function: NodejsFunction;
  readonly api: HttpApi;
  /** Domain name of the API endpoint, usable as a CloudFront origin. */
  readonly originDomainName: string;

  constructor(scope: Construct, id: string, props: UploadApiProps) {
    super(scope, id);
    const stack = Stack.of(this);

    const logGroup = new LogGroup(this, 'LogGroup', { retention: RetentionDays.TWO_WEEKS });

    this.function = new NodejsFunction(this, 'Router', {
      entry: join(import.meta.dirname, '../../../services/api/src/handlers/RouterApiHandler.ts'),
      handler: 'routerApiHandler',
      projectRoot: join(import.meta.dirname, '../../..'),
      depsLockFilePath: join(import.meta.dirname, '../../../pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup,
      environment: {
        TABLE_NAME: props.table.tableName,
        UPLOAD_BUCKET: props.bucket.bucketName,
        BUDGET_LIMIT_MICRO_USD: String(props.budgetLimitMicroUsd),
        IP_HASH_SECRET_PARAM,
        TURNSTILE_SECRET_PARAM,
        SITE_HOSTNAME_PARAM,
      },
      bundling: {
        // Top-level await in the handler needs ESM. Bundle the AWS SDK too:
        // @aws-sdk/s3-presigned-post is not part of the Lambda runtime.
        format: OutputFormat.ESM,
        target: 'node24',
        externalModules: [],
        minify: true,
        sourceMap: true,
        banner:
          "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });

    props.table.grantReadWriteData(this.function);
    this.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:PutObject'],
        resources: [props.bucket.arnForObjects('uploads/*')],
      }),
    );

    const parameterArn = (name: string) =>
      stack.formatArn({
        service: 'ssm',
        resource: 'parameter',
        resourceName: name.slice(1),
        arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
      });
    const secretArns = [IP_HASH_SECRET_PARAM, TURNSTILE_SECRET_PARAM].map(parameterArn);
    const hostnameArn = parameterArn(SITE_HOSTNAME_PARAM);

    this.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ssm:GetParameter'],
        resources: [...secretArns, hostnameArn],
      }),
    );
    this.function.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Decrypt'],
        resources: [stack.formatArn({ service: 'kms', resource: 'key', resourceName: '*' })],
        conditions: {
          StringEquals: {
            'kms:ViaService': `ssm.${stack.region}.amazonaws.com`,
            'kms:EncryptionContext:PARAMETER_ARN': secretArns,
          },
        },
      }),
    );

    this.api = new HttpApi(this, 'Api', {
      description: 'Vertragscheck API (behind CloudFront /api/*)',
      createDefaultStage: false,
    });
    new HttpStage(this, 'Stage', {
      httpApi: this.api,
      stageName: '$default',
      autoDeploy: true,
      throttle: {
        rateLimit: props.throttlingRateLimit ?? 5,
        burstLimit: props.throttlingBurstLimit ?? 10,
      },
    });
    this.api.addRoutes({
      path: '/api/uploads',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('Router', this.function),
    });

    this.originDomainName = Fn.select(2, Fn.split('/', this.api.apiEndpoint));
  }
}
