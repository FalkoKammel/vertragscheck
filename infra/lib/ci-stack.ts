import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import {
  CfnOIDCProvider,
  Effect,
  PolicyStatement,
  Role,
  WebIdentityPrincipal,
} from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

const GITHUB_OIDC_HOST = 'token.actions.githubusercontent.com';
const BOOTSTRAP_QUALIFIER = 'hnb659fds';

export interface CiStackProps extends StackProps {
  /** GitHub repository in the form "owner/name". */
  readonly repository: string;
  /** Branch that may assume the deploy role. */
  readonly branch: string;
}

/**
 * GitHub OIDC provider and the role the deploy workflow assumes.
 * Deployed once by hand, never by the pipeline (see bin/app.ts).
 * An account can hold only one provider per URL; if one already exists, import it instead.
 */
export class CiStack extends Stack {
  readonly deployRole: Role;

  constructor(scope: Construct, id: string, props: CiStackProps) {
    super(scope, id, props);

    const provider = new CfnOIDCProvider(this, 'GithubProvider', {
      url: `https://${GITHUB_OIDC_HOST}`,
      clientIdList: ['sts.amazonaws.com'],
    });

    this.deployRole = new Role(this, 'DeployRole', {
      roleName: 'VertragscheckGithubDeploy',
      description: `GitHub Actions deploy role for ${props.repository}, branch ${props.branch}`,
      assumedBy: new WebIdentityPrincipal(provider.attrArn, {
        StringEquals: {
          [`${GITHUB_OIDC_HOST}:aud`]: 'sts.amazonaws.com',
          [`${GITHUB_OIDC_HOST}:sub`]: `repo:${props.repository}:ref:refs/heads/${props.branch}`,
        },
      }),
    });

    this.deployRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:aws:iam::${this.account}:role/cdk-${BOOTSTRAP_QUALIFIER}-*-${this.account}-${this.region}`,
        ],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', { value: this.deployRole.roleArn });
  }
}
