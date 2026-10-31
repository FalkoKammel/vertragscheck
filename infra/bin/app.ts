import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack.js';
import { CiStack } from '../lib/ci-stack.js';
import { DataStack } from '../lib/data-stack.js';

const app = new App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-central-1' };

// Opt-in so that "cdk deploy --all" in the pipeline never touches the role that deploys it.
// Deploy by hand: pnpm --filter infra cdk deploy VertragscheckCi -c ci=true
if (app.node.tryGetContext('ci') === 'true') {
  new CiStack(app, 'VertragscheckCi', {
    env,
    owner: 'FalkoKammel',
    ownerId: 142214925,
    repository: 'vertragscheck',
    repositoryId: 1435846023,
    branch: 'main',
  });
} else {
  const webAssetPath = join(import.meta.dirname, '../../apps/web/out');
  if (!existsSync(join(webAssetPath, 'index.html'))) {
    throw new Error(
      `Static export not found at ${webAssetPath}. Run "pnpm --filter web build" first.`,
    );
  }
  const data = new DataStack(app, 'VertragscheckData', { env });
  new AppStack(app, 'VertragscheckApp', {
    env,
    webAssetPath,
    table: data.table,
    bucket: data.bucket,
  });
}
