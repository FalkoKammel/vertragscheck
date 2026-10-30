import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { App } from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack.js';

const webAssetPath = join(import.meta.dirname, '../../apps/web/out');
if (!existsSync(join(webAssetPath, 'index.html'))) {
  throw new Error(
    `Static export not found at ${webAssetPath}. Run "pnpm --filter web build" first.`,
  );
}

const app = new App();

new AppStack(app, 'VertragscheckApp', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-central-1' },
  webAssetPath,
});
