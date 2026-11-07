import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ApiController } from '../adapters/ApiController';
import { DynamoAnalysisStore } from '../adapters/DynamoAnalysisStore';
import { DynamoBudgetStore } from '../adapters/DynamoBudgetStore';
import { DynamoRateLimiter } from '../adapters/DynamoRateLimiter';
import { RandomTokenGenerator } from '../adapters/RandomTokenGenerator';
import { S3UploadTicketIssuer } from '../adapters/S3UploadTicketIssuer';
import { SsmSecrets } from '../adapters/SsmSecrets';
import { SystemClock } from '../adapters/SystemClock';
import { TurnstileCaptchaVerifier } from '../adapters/TurnstileCaptchaVerifier';
import { UuidGenerator } from '../adapters/UuidGenerator';
import { RequestUpload } from '../application/RequestUpload';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const tableName = env('TABLE_NAME');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secrets = new SsmSecrets(new SSMClient({}));
const [ipHashSecret, turnstileSecret, siteHostname] = await Promise.all([
  secrets.get(env('IP_HASH_SECRET_PARAM')),
  secrets.get(env('TURNSTILE_SECRET_PARAM')),
  secrets.get(env('SITE_HOSTNAME_PARAM')),
]);
const clock = new SystemClock();

const controller = new ApiController({
  requestsUpload: new RequestUpload({
    captchaVerifier: new TurnstileCaptchaVerifier(turnstileSecret, siteHostname),
    budget: new DynamoBudgetStore(db, tableName, clock, Number(env('BUDGET_LIMIT_MICRO_USD'))),
    rateLimiter: new DynamoRateLimiter(db, tableName, ipHashSecret),
    analysisStore: new DynamoAnalysisStore(db, tableName),
    uploadTicketIssuer: new S3UploadTicketIssuer(new S3Client({}), env('UPLOAD_BUCKET')),
    tokenGenerator: new RandomTokenGenerator(),
    idGenerator: new UuidGenerator(),
    clock,
  }),
});

export function routerApiHandler(event: APIGatewayProxyEventV2) {
  return controller.handle(event);
}
