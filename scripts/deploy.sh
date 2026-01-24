#!/bin/bash
set -e

# Fracti Deployment Script
# Usage: ./scripts/deploy.sh [stage]
# Requires: AWS credentials in .env file

STAGE=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Fracti Deployment Script ==="
echo "Stage: $STAGE"
echo ""

# Load environment variables
if [ -f "$ROOT_DIR/.env" ]; then
  export $(grep -E '^AWS|^TELEGRAM|^MINI_APP' "$ROOT_DIR/.env" | xargs)
  echo "Loaded environment from .env"
else
  echo "Error: .env file not found"
  exit 1
fi

# Verify AWS credentials
echo ""
echo "1. Verifying AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "Error: AWS credentials not valid"; exit 1; }
echo "   AWS credentials verified"

# Build
echo ""
echo "2. Building all packages..."
pnpm run build

# Deploy CDK
echo ""
echo "3. Deploying infrastructure with CDK..."
cd "$ROOT_DIR/infra/cdk"
pnpm exec cdk deploy --all --require-approval never

# Get outputs
WEBHOOK_URL=$(aws cloudformation describe-stacks --stack-name "tma-$STAGE" --query "Stacks[0].Outputs[?OutputKey=='TelegramWebhookUrl'].OutputValue" --output text)
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks --stack-name "tma-$STAGE" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" --output text)
CLOUDFRONT_DIST_ID=$(aws cloudformation describe-stacks --stack-name "tma-$STAGE" --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" --output text)
FRONTEND_BUCKET=$(aws cloudformation describe-stacks --stack-name "tma-$STAGE" --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)

echo ""
echo "   Webhook URL: $WEBHOOK_URL"
echo "   CloudFront: $CLOUDFRONT_DOMAIN"

# Setup bot webhook
echo ""
echo "4. Configuring Telegram bot..."
export WEBHOOK_URL
pnpm exec tsx scripts/setup.ts

# Upload frontend assets
echo ""
echo "5. Uploading frontend assets to S3..."
cd "$ROOT_DIR"
aws s3 sync gui/react/build/client "s3://$FRONTEND_BUCKET" --delete

# Invalidate CloudFront
echo ""
echo "6. Invalidating CloudFront cache..."
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DIST_ID" --paths "/*" > /dev/null

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "App URL: https://$CLOUDFRONT_DOMAIN/app"
echo "Bot: https://t.me/FractiBot"
echo ""
