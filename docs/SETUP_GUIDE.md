# Fracti Setup Guide

Complete guide to deploy Fracti from zero - including AWS account setup, Telegram bot creation, and production deployment.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [AWS Account Setup](#2-aws-account-setup)
3. [Install Required Tools](#3-install-required-tools)
4. [Create Telegram Bot](#4-create-telegram-bot)
5. [Clone and Configure Project](#5-clone-and-configure-project)
6. [Deploy to AWS](#6-deploy-to-aws)
7. [Configure Telegram Webhook](#7-configure-telegram-webhook)
8. [Deploy Frontend](#8-deploy-frontend)
9. [Enable Bedrock Model Access](#9-enable-bedrock-model-access)
10. [Test Your Deployment](#10-test-your-deployment)
11. [Local Development](#11-local-development)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

Before starting, ensure you have:

- **Computer** with macOS, Linux, or Windows (with WSL2)
- **Credit card** for AWS account (free tier available)
- **Telegram account** for bot creation
- **Basic terminal/command line knowledge**

---

## 2. AWS Account Setup

### 2.1 Create AWS Account

1. Go to [https://aws.amazon.com](https://aws.amazon.com)
2. Click **"Create an AWS Account"**
3. Enter email address and choose account name
4. Verify email and set password
5. Choose **"Personal"** account type
6. Enter payment information (required, but free tier available)
7. Verify phone number
8. Select **"Basic Support - Free"** plan
9. Complete signup

### 2.2 Create IAM User (Recommended)

Don't use root account for daily operations. Create an IAM user:

1. Sign in to [AWS Console](https://console.aws.amazon.com)
2. Search for **"IAM"** in the search bar
3. Click **"Users"** → **"Create user"**
4. Enter username: `fracti-admin`
5. Check **"Provide user access to the AWS Management Console"**
6. Select **"I want to create an IAM user"**
7. Set a password
8. Click **"Next"**

### 2.3 Attach Permissions

1. Select **"Attach policies directly"**
2. Search and select these policies:
   - `AdministratorAccess` (for initial setup)

   Or for more restricted access:
   - `AmazonDynamoDBFullAccess`
   - `AmazonS3FullAccess`
   - `AWSLambda_FullAccess`
   - `AmazonAPIGatewayAdministrator`
   - `CloudWatchLogsFullAccess`
   - `AmazonBedrockFullAccess`
   - `IAMFullAccess`
   - `AWSCloudFormationFullAccess`

3. Click **"Next"** → **"Create user"**

### 2.4 Create Access Keys

1. Click on your new user
2. Go to **"Security credentials"** tab
3. Click **"Create access key"**
4. Select **"Command Line Interface (CLI)"**
5. Check the confirmation box
6. Click **"Create access key"**
7. **SAVE** the Access Key ID and Secret Access Key (shown only once!)
8. Download the `.csv` file as backup

---

## 3. Install Required Tools

### 3.1 Install Node.js 20+

**macOS (using Homebrew):**
```bash
brew install node@20
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows (WSL2):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify installation:
```bash
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### 3.2 Install AWS CLI

**macOS:**
```bash
brew install awscli
```

**Ubuntu/Debian:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Windows (WSL2):**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

Verify installation:
```bash
aws --version  # Should show aws-cli/2.x.x
```

### 3.3 Configure AWS CLI

Run the configuration wizard:
```bash
aws configure
```

Enter when prompted:
```
AWS Access Key ID: [Your Access Key ID from step 2.4]
AWS Secret Access Key: [Your Secret Access Key from step 2.4]
Default region name: us-east-1
Default output format: json
```

Verify configuration:
```bash
aws sts get-caller-identity
```

Should show your account ID and user ARN.

### 3.4 Install AWS SAM CLI

**macOS:**
```bash
brew install aws-sam-cli
```

**Ubuntu/Debian:**
```bash
wget https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip
unzip aws-sam-cli-linux-x86_64.zip -d sam-installation
sudo ./sam-installation/install
```

Verify installation:
```bash
sam --version  # Should show SAM CLI, version 1.x.x
```

### 3.5 Install Git

**macOS:**
```bash
brew install git
```

**Ubuntu/Debian:**
```bash
sudo apt-get install git
```

---

## 4. Create Telegram Bot

### 4.1 Create Bot with BotFather

1. Open Telegram and search for **@BotFather**
2. Start chat and send `/newbot`
3. Enter bot name: `Fracti` (or your preferred name)
4. Enter username: `YourFractiBot` (must end with `bot`)
5. **SAVE** the bot token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 4.2 Configure Bot Settings

Send these commands to @BotFather:

```
/setdescription
```
Select your bot, then enter:
```
AI-powered expense splitting with TON blockchain settlements. Add me to your group chat to start tracking shared expenses!
```

```
/setabouttext
```
Select your bot, then enter:
```
Split expenses with friends using AI. Supports natural language, receipt scanning, and TON payments.
```

```
/setcommands
```
Select your bot, then enter:
```
start - Start using Fracti
help - Show help and commands
balance - View current balances
expenses - View expense history
settle - Settle debts with TON
add - How to add expenses
```

### 4.3 Enable Inline Mode (Optional)

```
/setinline
```
Select your bot, then enter a placeholder:
```
Search expenses...
```

### 4.4 Set Bot Picture (Optional)

```
/setuserpic
```
Select your bot and upload a logo image.

---

## 5. Clone and Configure Project

### 5.1 Clone Repository

```bash
git clone https://github.com/yourusername/fracti.git
cd fracti
```

### 5.2 Install Dependencies

```bash
npm install
```

### 5.3 Create Environment File

Create `.env` file in project root:

```bash
cat > .env << 'EOF'
# Telegram Bot Token (from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# AWS Region
AWS_REGION=us-east-1

# For local development only
TABLE_NAME=fracti-dev
S3_BUCKET_NAME=fracti-avatars-dev
NODE_ENV=development
EOF
```

Replace `your_bot_token_here` with your actual bot token.

### 5.4 Create Frontend Environment

Create `.env.local` for frontend:

```bash
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:3000
VITE_TON_MANIFEST_URL=https://your-domain.com/tonconnect-manifest.json
EOF
```

---

## 6. Deploy to AWS

### 6.1 Build the Application

```bash
npm run sam:build
```

This compiles TypeScript and prepares the Lambda function.

### 6.2 First-Time Deployment (Guided)

```bash
npm run sam:deploy:guided
```

Answer the prompts:

```
Stack Name [sam-app]: fracti
AWS Region [us-east-1]: us-east-1
Parameter TelegramBotToken []: <paste your bot token>
Parameter Stage [dev]: dev

Confirm changes before deploy [y/N]: y
Allow SAM CLI IAM role creation [Y/n]: Y
Disable rollback [y/N]: N
Save arguments to configuration file [Y/n]: Y
SAM configuration file [samconfig.toml]: samconfig.toml
SAM configuration environment [default]: default
```

Wait for deployment (5-10 minutes). Note the outputs:
- `ApiEndpoint` - Your API URL
- `TelegramWebhookUrl` - Webhook URL for Telegram
- `AvatarsBucketName` - S3 bucket for avatars

### 6.3 Subsequent Deployments

After first deployment, use:

```bash
npm run sam:build && npm run sam:deploy
```

---

## 7. Configure Telegram Webhook

### 7.1 Set Webhook URL

After deployment, configure Telegram to send updates to your API:

**Option A: Using npm script**
```bash
export TELEGRAM_BOT_TOKEN=your_bot_token_here
npm run webhook:set
```

**Option B: Manual curl command**
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "<YOUR_API_GATEWAY_URL>/api/webhooks/telegram"}'
```

Replace:
- `<YOUR_BOT_TOKEN>` with your Telegram bot token
- `<YOUR_API_GATEWAY_URL>` with the ApiEndpoint from deployment output

### 7.2 Verify Webhook

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
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

---

## 8. Deploy Frontend

### 8.1 Update Frontend Environment

Update `.env.local` with production API URL:

```bash
cat > .env.local << 'EOF'
VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/dev
VITE_TON_MANIFEST_URL=https://your-cloudfront-domain/tonconnect-manifest.json
EOF
```

### 8.2 Build Frontend

```bash
npm run build
```

### 8.3 Deploy to S3 (Production Only)

For production deployment with CloudFront:

```bash
npm run deploy:frontend
```

Or manually:
```bash
aws s3 sync dist/ s3://$(aws cloudformation describe-stacks \
  --stack-name fracti \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text) --delete
```

### 8.4 Create TON Connect Manifest

Create `public/tonconnect-manifest.json`:

```json
{
  "url": "https://your-app-domain.com",
  "name": "Fracti",
  "iconUrl": "https://your-app-domain.com/icon-512.png",
  "termsOfUseUrl": "https://your-app-domain.com/terms",
  "privacyPolicyUrl": "https://your-app-domain.com/privacy"
}
```

---

## 9. Enable Bedrock Model Access

### 9.1 Request Model Access

1. Go to [Amazon Bedrock Console](https://console.aws.amazon.com/bedrock)
2. Select **us-east-1** region
3. Click **"Model access"** in left sidebar
4. Click **"Manage model access"**
5. Find **"Anthropic"** section
6. Check **"Claude 3.5 Sonnet"**
7. Click **"Request model access"**
8. Fill out the use case form
9. Submit request

### 9.2 Wait for Approval

- Usually approved within minutes for Claude models
- Check status in Model access page
- Status should change to **"Access granted"**

### 9.3 Verify Access

```bash
aws bedrock list-foundation-models \
  --query "modelSummaries[?contains(modelId, 'claude')].[modelId, modelName]" \
  --output table
```

Should list Claude models you have access to.

---

## 10. Test Your Deployment

### 10.1 Test API Health

```bash
curl https://xxx.execute-api.us-east-1.amazonaws.com/dev/api/health
```

Should return:
```json
{"success": true, "data": {"status": "healthy", "timestamp": "..."}}
```

### 10.2 Test Telegram Bot

1. Open Telegram
2. Find your bot by username
3. Send `/start`
4. Bot should respond with welcome message

### 10.3 Test in Group Chat

1. Create a test group
2. Add your bot to the group
3. Send a message: `Hello everyone!`
4. Bot silently registers you (no response)
5. Send: `@YourFractiBot I paid 50 for pizza`
6. Bot should respond with expense confirmation

### 10.4 Check CloudWatch Logs

```bash
npm run sam:logs
```

Or in AWS Console:
1. Go to CloudWatch
2. Click "Log groups"
3. Find `/aws/lambda/fracti-api-dev`
4. View recent log streams

---

## 11. Local Development

### 11.1 Start Frontend Dev Server

```bash
npm run dev
```

Opens at http://localhost:5173

### 11.2 Start Backend Locally

In a new terminal:

```bash
npm run sam:local
```

Starts API at http://localhost:3000

Note: Requires Docker for SAM local.

### 11.3 Test Local API

```bash
curl http://localhost:3000/api/health
```

### 11.4 Local Environment Variables

For local SAM, create `env.json`:

```json
{
  "FractiFunction": {
    "TELEGRAM_BOT_TOKEN": "your_bot_token",
    "TABLE_NAME": "fracti-dev",
    "S3_BUCKET_NAME": "fracti-avatars-dev",
    "NODE_ENV": "development"
  }
}
```

Run with:
```bash
sam local start-api --env-vars env.json
```

---

## 12. Troubleshooting

### Common Issues

#### "Access Denied" on S3

Ensure your IAM user has S3 permissions:
```bash
aws s3 ls s3://fracti-avatars-xxx/
```

#### "Model access denied" on Bedrock

1. Check you requested access in us-east-1 region
2. Verify access status in Bedrock console
3. Wait a few minutes after approval

#### Webhook not receiving updates

1. Verify webhook URL is correct
2. Check webhook info: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. Check for pending errors in webhook info response

#### Lambda timeout

1. Check CloudWatch logs for errors
2. Increase timeout in `template.yaml` (currently 60s)
3. Check DynamoDB/S3 permissions

#### Build errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear SAM build cache
rm -rf .aws-sam
npm run sam:build
```

### Getting Help

- Check [AWS SAM documentation](https://docs.aws.amazon.com/serverless-application-model/)
- Check [Grammy documentation](https://grammy.dev/)
- Open issue on GitHub repository

---

## Quick Reference

### Useful Commands

```bash
# Build and deploy
npm run sam:build && npm run sam:deploy

# View logs
npm run sam:logs

# Set webhook
npm run webhook:set

# Deploy frontend
npm run deploy:frontend

# Type check
npm run typecheck

# Run tests
npm run test
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `TABLE_NAME` | Auto | DynamoDB table (set by SAM) |
| `S3_BUCKET_NAME` | Auto | S3 bucket (set by SAM) |
| `AWS_REGION` | No | AWS region (default: us-east-1) |
| `BEDROCK_MODEL_ID` | No | Claude model ID |
| `NODE_ENV` | No | Environment mode |

### AWS Resources Created

| Resource | Name Pattern | Purpose |
|----------|--------------|---------|
| DynamoDB | `fracti-{stage}` | Data storage |
| S3 Bucket | `fracti-avatars-{account}-{stage}` | Avatar images |
| Lambda | `fracti-api-{stage}` | API backend |
| API Gateway | `fracti-{stage}` | HTTP API |
| CloudWatch | `/aws/lambda/fracti-api-{stage}` | Logs |

---

## Next Steps

After successful deployment:

1. **Add bot to group chats** - Start tracking expenses
2. **Configure Mini App** - Set up Telegram Mini App in @BotFather
3. **Set up monitoring** - Configure CloudWatch alarms
4. **Enable production mode** - Deploy with `Stage=prod`
5. **Add custom domain** - Configure Route 53 and CloudFront

---

*Last updated: January 2026*
