# Fracti AWS Deployment Guide

Complete guide to deploy Fracti from scratch on AWS.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS Account Setup](#aws-account-setup)
3. [Install Required Tools](#install-required-tools)
4. [Configure AWS CLI](#configure-aws-cli)
5. [Enable AWS Bedrock](#enable-aws-bedrock)
6. [Create Telegram Bot](#create-telegram-bot)
7. [Deploy Backend](#deploy-backend)
8. [Deploy Frontend](#deploy-frontend)
9. [Set Up Telegram Webhook](#set-up-telegram-webhook)
10. [Verify Deployment](#verify-deployment)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 20+ installed
- npm or pnpm
- Git
- A credit card for AWS account (free tier covers most usage)
- Telegram account

---

## AWS Account Setup

### Step 1: Create AWS Account

1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Enter email, password, and account name
4. Choose "Personal" account type
5. Enter payment information (required, but free tier applies)
6. Verify phone number
7. Select "Basic Support" (free)

### Step 2: Secure Your Account

1. **Enable MFA on Root Account**:
   - Go to IAM console: https://console.aws.amazon.com/iam/
   - Click your account name → Security credentials
   - Under MFA, click "Assign MFA device"
   - Use authenticator app (Google Authenticator, Authy)

2. **Create IAM User for Development**:
   ```bash
   # Don't use root account for daily work!
   ```
   - Go to IAM → Users → Create user
   - Username: `fracti-developer`
   - Check "Provide user access to AWS Management Console"
   - Click Next
   - Select "Attach policies directly"
   - Search and attach these policies:
     - `AdministratorAccess` (for hackathon - use more restrictive in production)
   - Click Next → Create user
   - **Save the console sign-in URL**

3. **Create Access Keys**:
   - Click on your new user → Security credentials
   - Click "Create access key"
   - Select "Command Line Interface (CLI)"
   - Click Next → Create access key
   - **Download .csv file** - you need these credentials!

---

## Install Required Tools

### AWS CLI

**macOS:**
```bash
brew install awscli
```

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Windows:**
Download from: https://aws.amazon.com/cli/

### AWS SAM CLI

**macOS:**
```bash
brew install aws-sam-cli
```

**Linux:**
```bash
wget https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip
unzip aws-sam-cli-linux-x86_64.zip -d sam-installation
sudo ./sam-installation/install
```

**Windows:**
Download MSI from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

### Verify Installation

```bash
aws --version
# aws-cli/2.x.x ...

sam --version
# SAM CLI, version 1.x.x
```

---

## Configure AWS CLI

```bash
aws configure
```

Enter:
- AWS Access Key ID: (from downloaded CSV)
- AWS Secret Access Key: (from downloaded CSV)
- Default region name: `us-east-1` (recommended for Bedrock)
- Default output format: `json`

**Verify:**
```bash
aws sts get-caller-identity
```

Should return your account info.

---

## Enable AWS Bedrock

Bedrock requires explicit model access.

### Step 1: Navigate to Bedrock

1. Go to AWS Console
2. Search for "Bedrock"
3. Select region: **us-east-1** (best model availability)

### Step 2: Request Model Access

1. In Bedrock console, click "Model access" in left sidebar
2. Click "Manage model access"
3. Find **Anthropic** section
4. Check **Claude 3.5 Sonnet**
5. Click "Request model access"
6. Accept terms and submit

**Note:** Access is usually granted within minutes, but can take up to 24 hours.

### Step 3: Verify Access

```bash
aws bedrock list-foundation-models --region us-east-1 --query "modelSummaries[?contains(modelId, 'claude-3-5-sonnet')]"
```

Should list Claude 3.5 Sonnet models.

---

## Create Telegram Bot

### Step 1: Create Bot with BotFather

1. Open Telegram
2. Search for `@BotFather`
3. Send `/newbot`
4. Enter bot name: `Fracti`
5. Enter username: `YourFractiBot` (must end in `bot`)
6. **Save the token** - looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

### Step 2: Configure Bot Settings

Send these commands to BotFather:

```
/setdescription
Select your bot
AI-powered expense splitting with TON settlements

/setabouttext
Select your bot
Split expenses with friends, powered by AI. Pay with TON.

/setcommands
Select your bot
balance - View your balances
expenses - Recent expenses
settle - Settlement suggestions
help - Show help
```

### Step 3: Enable Mini App

1. Send `/newapp` to BotFather
2. Select your bot
3. Enter title: `Fracti`
4. Enter description: `Split expenses with AI`
5. Upload a 640x360 image (or skip)
6. **For Web App URL**: We'll set this after deployment

---

## Deploy Backend

### Step 1: Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/fracti.git
cd fracti
npm install
```

### Step 2: Build SAM Application

```bash
sam build
```

### Step 3: Deploy (First Time)

```bash
sam deploy --guided
```

Answer the prompts:
```
Stack Name: fracti
AWS Region: us-east-1
Parameter TelegramBotToken: YOUR_BOT_TOKEN_HERE
Parameter Stage: dev
Confirm changes before deploy: y
Allow SAM CLI IAM role creation: Y
Disable rollback: N
Save arguments to configuration file: Y
SAM configuration file: samconfig.toml
SAM configuration environment: default
```

### Step 4: Note the Outputs

After deployment, note these values:
```
ApiEndpoint = https://xxxxxxx.execute-api.us-east-1.amazonaws.com/dev
TelegramWebhookUrl = https://xxxxxxx.execute-api.us-east-1.amazonaws.com/dev/api/webhooks/telegram
```

### Subsequent Deployments

```bash
sam build && sam deploy
```

---

## Deploy Frontend

### Step 1: Configure Environment

Create `.env.production`:
```env
VITE_API_URL=https://YOUR_API_ENDPOINT/dev
VITE_TON_MANIFEST_URL=https://YOUR_CLOUDFRONT_DOMAIN/tonconnect-manifest.json
```

### Step 2: Build Frontend

```bash
npm run build
```

### Step 3: Deploy to S3 (Production Stage)

First, deploy with prod stage to create S3 bucket:
```bash
sam deploy --parameter-overrides Stage=prod TelegramBotToken=YOUR_TOKEN
```

Then sync frontend:
```bash
# Get bucket name
BUCKET=$(aws cloudformation describe-stacks --stack-name fracti --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)

# Upload files
aws s3 sync dist/ s3://$BUCKET --delete

# Invalidate CloudFront cache
DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[0].DomainName=='${BUCKET}.s3.amazonaws.com'].Id" --output text)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

### Step 4: Get CloudFront URL

```bash
aws cloudformation describe-stacks --stack-name fracti --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue" --output text
```

---

## Set Up Telegram Webhook

### Step 1: Register Webhook

```bash
# Get webhook URL
WEBHOOK_URL=$(aws cloudformation describe-stacks --stack-name fracti --query "Stacks[0].Outputs[?OutputKey=='TelegramWebhookUrl'].OutputValue" --output text)

# Set webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}"
```

### Step 2: Verify Webhook

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Should show:
```json
{
  "ok": true,
  "result": {
    "url": "https://xxx.execute-api.us-east-1.amazonaws.com/dev/api/webhooks/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### Step 3: Configure Mini App URL

1. Open Telegram, go to BotFather
2. Send `/editapp`
3. Select your bot and app
4. Select "Edit Web App URL"
5. Enter your CloudFront URL: `https://dxxxxxx.cloudfront.net`

---

## Verify Deployment

### Test API Health

```bash
API_URL=$(aws cloudformation describe-stacks --stack-name fracti --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)

curl "${API_URL}/api/health"
```

Should return:
```json
{"status":"ok","timestamp":"...","service":"fracti-api"}
```

### Test Bot

1. Open Telegram
2. Find your bot
3. Send `/start`
4. Bot should respond with welcome message

### Test Mini App

1. In bot chat, tap the menu button
2. Select "Fracti" app
3. Mini app should load

---

## Troubleshooting

### "Access Denied" on Bedrock

```bash
# Check model access
aws bedrock list-foundation-models --region us-east-1 | grep claude

# If empty, model access not granted yet
# Go to Bedrock console → Model access → Request access
```

### Lambda Function Errors

```bash
# View logs
sam logs --stack-name fracti --tail

# Or specific function
sam logs --stack-name fracti --name FractiFunction --tail
```

### Telegram Webhook Not Working

```bash
# Check webhook status
curl "https://api.telegram.org/bot${TOKEN}/getWebhookInfo"

# Check for errors
curl "https://api.telegram.org/bot${TOKEN}/getUpdates"

# Re-register webhook
curl -X POST "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -d "url=${WEBHOOK_URL}" \
  -d "drop_pending_updates=true"
```

### CORS Errors in Mini App

Check that your API Gateway CORS configuration matches the CloudFront domain.

### DynamoDB Errors

```bash
# Check table exists
aws dynamodb describe-table --table-name fracti-dev

# Check items
aws dynamodb scan --table-name fracti-dev --limit 5
```

---

## Cost Estimation (Free Tier)

| Service | Free Tier | Estimated Usage |
|---------|-----------|-----------------|
| Lambda | 1M requests/month | ~$0 |
| API Gateway | 1M requests/month | ~$0 |
| DynamoDB | 25GB storage, 25 WCU/RCU | ~$0 |
| Bedrock Claude | Pay per token | ~$5-20/month |
| S3 | 5GB storage | ~$0 |
| CloudFront | 1TB transfer | ~$0 |

**Total estimated cost:** $5-25/month (mostly Bedrock usage)

---

## Production Checklist

- [ ] Enable CloudWatch alarms
- [ ] Set up billing alerts
- [ ] Enable DynamoDB point-in-time recovery
- [ ] Configure custom domain
- [ ] Enable WAF on API Gateway
- [ ] Set up CI/CD pipeline
- [ ] Configure proper IAM roles (not AdministratorAccess)
- [ ] Enable CloudTrail logging
- [ ] Set up monitoring dashboard

---

## Quick Reference Commands

```bash
# Build and deploy
sam build && sam deploy

# View logs
sam logs --stack-name fracti --tail

# Local development
sam local start-api

# Delete stack (careful!)
sam delete --stack-name fracti

# Get all outputs
aws cloudformation describe-stacks --stack-name fracti --query "Stacks[0].Outputs"
```
