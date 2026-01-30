#!/usr/bin/env npx tsx
/**
 * Deployment script for Fracti
 *
 * This script:
 * 1. Runs CDK deploy
 * 2. Invalidates CloudFront cache
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { CloudFrontClient, CreateInvalidationCommand, GetInvalidationCommand } from '@aws-sdk/client-cloudfront';

const DISTRIBUTION_ID = 'E1MY9CH84SLGWP';
const FRONTEND_BUCKET = 'tma-frontend-057106046853-dev';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deploy() {
  console.log('🚀 Starting deployment...\n');

  // Step 1: Run CDK deploy
  console.log('📦 Running CDK deploy...');
  try {
    execSync('npx cdk deploy --all --require-approval never', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log('✅ CDK deploy completed\n');
  } catch (_error) {
    console.error('❌ CDK deploy failed');
    process.exit(1);
  }

  // Step 2: Sync frontend assets to S3
  console.log('📤 Syncing frontend assets to S3...');
  try {
    const webBuildPath = path.join(__dirname, '../../../apps/web/build/client');
    execSync(`aws s3 sync ${webBuildPath} s3://${FRONTEND_BUCKET} --delete`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log('✅ Frontend assets synced\n');
  } catch (_error) {
    console.error('❌ S3 sync failed');
    process.exit(1);
  }

  // Step 2: Invalidate CloudFront cache
  console.log('🔄 Invalidating CloudFront cache...');
  try {
    const client = new CloudFrontClient({});

    const createCommand = new CreateInvalidationCommand({
      DistributionId: DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `deploy-${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: ['/*'],
        },
      },
    });

    const createResponse = await client.send(createCommand);
    const invalidationId = createResponse.Invalidation?.Id;

    if (!invalidationId) {
      throw new Error('Failed to create invalidation');
    }

    console.log(`   Invalidation ID: ${invalidationId}`);
    console.log('   Waiting for invalidation to complete...');

    // Poll for completion
    let status = 'InProgress';
    while (status === 'InProgress') {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const getCommand = new GetInvalidationCommand({
        DistributionId: DISTRIBUTION_ID,
        Id: invalidationId,
      });

      const getResponse = await client.send(getCommand);
      status = getResponse.Invalidation?.Status || 'Unknown';
      process.stdout.write('.');
    }

    console.log('\n✅ CloudFront cache invalidated\n');
  } catch (error) {
    console.error('⚠️  CloudFront invalidation failed:', error);
    console.log('   You may need to manually invalidate the cache');
  }

  console.log('🎉 Deployment complete!');
}

deploy().catch((error: unknown) => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
