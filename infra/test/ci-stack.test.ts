import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { CiStack } from '../lib/ci-stack.js';

let template: Template;

beforeAll(() => {
  const stack = new CiStack(new App(), 'Test', {
    env: { account: '123456789012', region: 'eu-central-1' },
    owner: 'FalkoKammel',
    ownerId: 142214925,
    repository: 'vertragscheck',
    repositoryId: 1435846023,
    branch: 'main',
  });
  template = Template.fromStack(stack);
});

describe('CiStack', () => {
  it('creates the GitHub OIDC provider for sts.amazonaws.com', () => {
    template.hasResourceProperties('AWS::IAM::OIDCProvider', {
      Url: 'https://token.actions.githubusercontent.com',
      ClientIdList: ['sts.amazonaws.com'],
    });
  });

  it('trusts only the main branch of the repository', () => {
    const roles = template.findResources('AWS::IAM::Role');
    const role = Object.values(roles)[0] as {
      Properties: { AssumeRolePolicyDocument: { Statement: unknown[] } };
    };
    const statements = role.Properties.AssumeRolePolicyDocument.Statement;
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatchObject({
      Action: 'sts:AssumeRoleWithWebIdentity',
      Effect: 'Allow',
      Condition: {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub':
            'repo:FalkoKammel@142214925/vertragscheck@1435846023:ref:refs/heads/main',
        },
      },
    });
    expect(Object.keys((statements[0] as { Condition: object }).Condition)).toEqual([
      'StringEquals',
    ]);
  });

  it('may only assume the CDK bootstrap roles', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const statements = Object.values(policies).flatMap(
      (p) =>
        (p as { Properties: { PolicyDocument: { Statement: unknown[] } } }).Properties
          .PolicyDocument.Statement,
    );
    expect(statements).toEqual([
      {
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Resource: 'arn:aws:iam::123456789012:role/cdk-hnb659fds-*-123456789012-eu-central-1',
      },
    ]);
    const role = Object.values(template.findResources('AWS::IAM::Role'))[0] as {
      Properties: Record<string, unknown>;
    };
    expect(role.Properties).not.toHaveProperty('ManagedPolicyArns');
  });
});
