import { isIP } from 'node:net';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { z } from 'zod';
import type { UseCase } from '../application/UseCase';
import type { DeleteAnalysisInput } from '../application/DeleteAnalysis';
import type { GetAnalysisInput, GetAnalysisOutput } from '../application/GetAnalysis';
import type { RequestUploadInput, RequestUploadOutput } from '../application/RequestUpload';
import { AnalysisNotFoundError, DomainError, InvalidDeleteTokenError } from '../domain/DomainError';
import { toAnalysisResponse } from './AnalysisResponseMapper';

export interface ApiUseCases {
  requestsUpload: UseCase<RequestUploadInput, RequestUploadOutput>;
  getsAnalysis: UseCase<GetAnalysisInput, GetAnalysisOutput>;
  deletesAnalysis: UseCase<DeleteAnalysisInput, void>;
}

export const STATUS_BY_CODE: Record<string, number> = {
  CAPTCHA_INVALID: 403,
  DAILY_LIMIT_REACHED: 429,
  BUDGET_EXHAUSTED: 503,
  ANALYSIS_NOT_FOUND: 404,
  INVALID_DELETE_TOKEN: 403,
};

const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

const analysisIdSchema = z.uuid();

// 32 random bytes as base64url (see RandomTokenGenerator)
const bearerTokenPattern = /^Bearer ([A-Za-z0-9_-]{43})$/;

function deleteTokenOf(event: APIGatewayProxyEventV2): string {
  const match = bearerTokenPattern.exec(event.headers.authorization ?? '');
  if (!match?.[1]) throw new InvalidDeleteTokenError();
  return match[1];
}

const requestUploadBody = z.strictObject({
  captchaToken: z.string().min(1).max(4096),
  contractType: z.enum(['rental', 'employment']),
  language: z.enum(['de', 'en']),
});

type ApiResult = Required<
  Pick<APIGatewayProxyStructuredResultV2, 'statusCode' | 'headers' | 'body'>
>;

function json(statusCode: number, payload: unknown): ApiResult {
  return { statusCode, headers: HEADERS, body: JSON.stringify(payload) };
}

// `CloudFront-Viewer-Address` looks like `203.0.113.7:4711` or `2001:db8::1:4711` (IP, last colon, port)
export function clientIpOf(event: APIGatewayProxyEventV2): string {
  const viewer = event.headers['cloudfront-viewer-address'];
  if (viewer) {
    const ip = viewer.slice(0, viewer.lastIndexOf(':'));
    if (isIP(ip) !== 0) return ip;
  }
  return event.requestContext.http.sourceIp;
}

function parseJson(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return undefined;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export class ApiController {
  constructor(private readonly _useCases: ApiUseCases) {}

  public async handle(event: APIGatewayProxyEventV2): Promise<ApiResult> {
    try {
      switch (event.routeKey) {
        case 'POST /api/uploads': {
          const body = requestUploadBody.safeParse(parseJson(event));
          if (!body.success) return json(400, { code: 'INVALID_REQUEST' });

          const output = await this._useCases.requestsUpload.execute({
            contractType: body.data.contractType,
            language: body.data.language,
            captchaToken: body.data.captchaToken,
            clientIp: clientIpOf(event),
          });
          return json(201, output);
        }
        case 'GET /api/analyses/{id}': {
          const id = analysisIdSchema.safeParse(event.pathParameters?.id);
          if (!id.success) throw new AnalysisNotFoundError();

          const output = await this._useCases.getsAnalysis.execute({ analysisId: id.data });
          console.log({ msg: 'analysis read', id: id.data, status: output.status });
          return json(200, toAnalysisResponse(output));
        }
        case 'DELETE /api/analyses/{id}': {
          const id = analysisIdSchema.safeParse(event.pathParameters?.id);
          if (!id.success) throw new AnalysisNotFoundError();
          const deleteToken = deleteTokenOf(event);

          await this._useCases.deletesAnalysis.execute({ analysisId: id.data, deleteToken });
          console.log({ msg: 'analysis deleted', id: id.data });
          return { statusCode: 204, headers: HEADERS, body: '' };
        }
        default:
          return json(404, { code: 'NOT_FOUND' });
      }
    } catch (err: unknown) {
      return this.toHttpError(err);
    }
  }

  private toHttpError(err: unknown): ApiResult {
    if (err instanceof DomainError) {
      return json(STATUS_BY_CODE[err.code] ?? 400, { code: err.code });
    }
    console.error({ msg: 'unhandled error', name: err instanceof Error ? err.name : typeof err });
    return json(500, { code: 'INTERNAL' });
  }
}
