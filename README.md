# Fracti

**Fractionalize costs. Settle on-chain.**

Fracti is an AI-powered Telegram Mini App that turns unstructured group chat chaos into structured financial settlements using AWS Bedrock and TON blockchain.

## Features

- **AI-Powered Expense Parsing** - Natural language processing to extract expenses from chat messages (only when @mentioned)
- **Receipt OCR** - Scan receipts with Claude Vision to automatically itemize expenses
- **Automatic User Tracking** - Bot captures all group messages to track members automatically
- **User Avatars** - Fetches Telegram profile photos and stores them in S3
- **Debt Graph Visualization** - Interactive force-directed graph showing who owes whom
- **Min-Cash-Flow Optimization** - Minimize the number of transactions needed to settle debts
- **On-Chain Settlements** - Pay debts directly with TON Connect wallet integration
- **Telegram Native** - Seamless integration as a Telegram Mini App
- **Multi-language Support** - English and Russian localization

## How It Works

### Bot Behavior
1. **Captures ALL messages** - Every message in the group registers the sender as a member
2. **Fetches avatars** - Downloads user profile photos from Telegram and stores in S3
3. **AI parsing on @mention only** - Only processes expenses when bot is @mentioned (e.g., `@FractiBot I paid 50 for dinner`)
4. **Receipt scanning** - Photo messages trigger receipt OCR automatically

### Expense Flow
```
User: "@FractiBot I paid 100 TON for dinner with @alice and @bob"
         ↓
Bot: Parses with Claude AI
         ↓
Bot: Creates expense, splits equally
         ↓
Bot: "✅ Expense created: dinner (100 TON) - Paid by John, split 3 ways (33.33 each)"
```

## Tech Stack

### Frontend (Telegram Mini App)
- **React 19** - UI framework
- **React Router v7** - Client-side routing
- **Vite 6** - Build tool and dev server
- **shadcn/ui** - Tailwind CSS components
- **react-force-graph-2d** - Debt web visualization
- **@twa-dev/sdk** - Telegram Mini App SDK
- **@tonconnect/ui-react** - TON wallet integration
- **i18next** - Internationalization

### Backend (AWS Serverless + Hono)
- **Hono** - Lightweight web framework on Lambda
- **Grammy** - Telegram Bot framework
- **AWS Lambda** - Node.js 20.x (ARM64)
- **Amazon API Gateway** - HTTP API
- **Amazon DynamoDB** - Single-table design with GSI
- **Amazon S3** - User avatar storage
- **AWS SAM** - Infrastructure as Code

### AI Layer
- **Amazon Bedrock** - Claude 3.5 Sonnet
- **Text Parser Agent** - Natural language to structured JSON
- **Vision Agent** - Receipt OCR and itemization

### Blockchain
- **TON Connect** - Wallet connection and transactions
- **Native TON** - Direct payments

## Project Structure

```
fracti/
├── app/                          # React Frontend
│   ├── components/               # UI Components
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── DebtGraph.tsx         # Force graph visualization
│   │   ├── ExpenseCard.tsx       # Expense display
│   │   ├── SettlementCard.tsx    # Settlement display
│   │   └── WalletButton.tsx      # TON Connect button
│   ├── routes/                   # Page routes
│   │   ├── home.tsx              # Dashboard
│   │   ├── expenses.tsx          # Expenses list
│   │   ├── settle.tsx            # Settlements
│   │   └── scan.tsx              # Receipt scanner
│   ├── lib/                      # Utilities
│   │   ├── api.ts                # API client
│   │   ├── telegram.tsx          # Telegram SDK wrapper
│   │   ├── ton.ts                # TON utilities
│   │   ├── i18n/                 # Translations (en, ru)
│   │   └── utils.ts              # General utilities
│   └── styles/                   # CSS
├── server/                       # AWS Lambda (Hono)
│   ├── index.ts                  # Hono app entry point
│   ├── routes/                   # API routes
│   │   ├── groups.ts             # Group CRUD
│   │   ├── expenses.ts           # Expense CRUD
│   │   ├── settlements.ts        # Settlement & debt calculation
│   │   ├── ai.ts                 # AI parsing endpoints
│   │   └── webhooks.ts           # Telegram bot webhook
│   ├── middleware/
│   │   ├── auth.ts               # Telegram auth middleware
│   │   └── rateLimit.ts          # Rate limiting
│   └── lib/                      # Shared utilities
│       ├── bedrock.ts            # AWS Bedrock client
│       ├── bot.ts                # Telegram bot handlers
│       ├── dynamodb.ts           # DynamoDB operations
│       ├── s3.ts                 # S3 avatar storage
│       ├── debt-graph.ts         # Min-cash-flow algorithm
│       ├── telegram.ts           # Telegram Bot API helpers
│       └── config.ts             # Environment config with Zod
├── template.yaml                 # AWS SAM template
├── samconfig.toml                # SAM deployment config
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- AWS CLI configured with credentials
- AWS SAM CLI installed
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/fracti.git
cd fracti
npm install
```

### 2. Configure Environment

Create `.env` file for local development:

```env
# Required
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TABLE_NAME=fracti-dev
S3_BUCKET_NAME=fracti-avatars-dev

# Optional
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
AWS_REGION=us-east-1
NODE_ENV=development

# Frontend (create .env.local)
VITE_API_URL=http://localhost:3000
VITE_TON_MANIFEST_URL=https://your-domain/tonconnect-manifest.json
```

### 3. Run Locally

```bash
# Start frontend dev server
npm run dev

# In another terminal, start backend with SAM
npm run sam:local
```

### 4. Deploy to AWS

```bash
# First time deployment (guided)
npm run sam:deploy:guided

# Subsequent deployments
npm run sam:build && npm run sam:deploy
```

### 5. Configure Telegram Webhook

After deployment, set your bot's webhook:

```bash
# Using the npm script (requires AWS CLI)
npm run webhook:set

# Or manually
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=<YOUR_API_GATEWAY_URL>/api/webhooks/telegram"
```

### 6. Deploy Frontend

```bash
npm run build
npm run deploy:frontend
```

## AWS Resources Created

The SAM template creates:

| Resource | Description |
|----------|-------------|
| `FractiTable` | DynamoDB table with GSI1 and GSI2 |
| `AvatarsBucket` | S3 bucket for user avatars (public read) |
| `FractiApi` | HTTP API Gateway |
| `FractiFunction` | Lambda function running Hono |
| `FrontendBucket` | S3 bucket for frontend (production only) |
| `FrontendDistribution` | CloudFront CDN (production only) |

## Database Schema

Single-table design in DynamoDB:

| PK | SK | GSI1PK | GSI1SK | Description |
|---|---|---|---|---|
| `GROUP#<id>` | `METADATA` | - | - | Group information |
| `GROUP#<id>` | `USER#<telegramId>` | `USER#<telegramId>` | `GROUP#<id>` | User profile with avatar |
| `GROUP#<id>` | `TX#<timestamp>` | - | - | Expense record |
| `GROUP#<id>` | `SETTLE#<timestamp>` | - | - | Settlement record |

**GSI2** enables O(1) lookups by expense/settlement ID.

## API Endpoints

### Groups
- `GET /api/groups` - List user's groups
- `GET /api/groups/:id` - Get group with members (includes avatarUrl)
- `POST /api/groups` - Create new group
- `POST /api/groups/:id/join` - Join a group
- `PUT /api/groups/:id/wallet` - Update wallet address

### Expenses
- `GET /api/groups/:id/expenses` - List expenses
- `POST /api/groups/:id/expenses` - Create expense
- `DELETE /api/groups/:id/expenses/:expenseId` - Delete expense

### Settlements
- `GET /api/groups/:id/debts` - Get debt graph with balances
- `GET /api/groups/:id/settlements` - List settlements
- `POST /api/groups/:id/settlements` - Record settlement
- `PUT /api/groups/:id/settlements/:settlementId` - Confirm settlement

### AI
- `POST /api/ai/parse` - Parse expense from text
- `POST /api/ai/vision` - Extract items from receipt image

### Webhooks
- `POST /api/webhooks/telegram` - Telegram bot webhook

### Health
- `GET /api/health` - API health check

## Avatar System

Avatars are fetched and stored automatically:

```
1. User sends message in group
         ↓
2. Bot checks if user has avatar in DynamoDB
         ↓ (no avatar)
3. Call Telegram API: getUserProfilePhotos
         ↓
4. Download largest photo
         ↓
5. Upload to S3: avatars/{telegramId}.jpg
         ↓
6. Store relative path in DynamoDB
         ↓
7. API transforms to full S3 URL on read
```

**Storage format:**
- DynamoDB: `avatarUrl: "avatars/123456.jpg"` (relative)
- API response: `avatarUrl: "https://bucket.s3.region.amazonaws.com/avatars/123456.jpg"` (full URL)

## AI Agents

### Parser Agent
Converts natural language to structured expense data:
```
Input: "@FractiBot I paid 50 TON for dinner with Alice and Bob"
Output: {
  "payer": null,
  "amount": 50,
  "currency": "TON",
  "description": "dinner",
  "beneficiaries": ["Alice", "Bob"],
  "confidence": 0.95
}
```

### Vision Agent
Extracts itemized data from receipt images:
```json
{
  "items": [
    {"name": "Pizza", "quantity": 2, "price": 24.00}
  ],
  "total": 24.00,
  "merchant": "Pizza Palace",
  "confidence": 0.94
}
```

## Min-Cash-Flow Algorithm

The settlement optimization algorithm minimizes transactions:

1. Calculate net balance for each user
2. Separate users into creditors (+balance) and debtors (-balance)
3. Match debtors to creditors using greedy approach
4. Generate minimal set of payment instructions

Example: If A owes B $10 and B owes C $10, suggest A pay C $10 directly.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `TABLE_NAME` | Yes | DynamoDB table name |
| `S3_BUCKET_NAME` | Yes | S3 bucket for avatars |
| `BEDROCK_MODEL_ID` | No | Claude model ID (default: claude-3-5-sonnet) |
| `AWS_REGION` | No | AWS region (default: us-east-1) |
| `NODE_ENV` | No | Environment (development/production) |
| `MINI_APP_URL` | No | Telegram Mini App URL |
| `ALLOWED_ORIGINS` | No | CORS allowed origins |

## Scripts

```bash
# Frontend
npm run dev              # Start Vite dev server
npm run build            # Build frontend for production
npm run preview          # Preview production build
npm run typecheck        # TypeScript type checking
npm run lint             # Run ESLint

# Backend
npm run sam:build        # Build SAM application
npm run sam:deploy       # Deploy to AWS
npm run sam:deploy:guided # Guided deployment (first time)
npm run sam:local        # Run API locally with SAM
npm run sam:logs         # Tail Lambda logs

# Testing
npm run test             # Run tests with Vitest
npm run test:run         # Run tests once
npm run test:coverage    # Run tests with coverage

# Deployment
npm run deploy:frontend  # Deploy frontend to S3
npm run webhook:set      # Set Telegram webhook
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Telegram Chat  │────▶│  Bot Webhook     │
│  (ALL messages) │     │  (Grammy)        │
└─────────────────┘     └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Register User   │
                        │  + Fetch Avatar  │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  @mention only?  │
                        └────────┬─────────┘
                                 │ yes
┌─────────────────┐     ┌────────▼─────────┐     ┌─────────────────┐
│  Mini App (UI)  │────▶│  API Gateway     │────▶│  Hono Lambda    │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                        ┌────────▼─────────┐     ┌────────▼────────┐
                        │   AWS Bedrock    │     │    DynamoDB     │
                        │  (Claude 3.5)    │     │  (Single Table) │
                        └──────────────────┘     └─────────────────┘
                                                          │
                                                 ┌────────▼────────┐
                                                 │   S3 Avatars    │
                                                 └─────────────────┘
```

## Security

- **Telegram Init Data Validation** - All API requests validated with @grammyjs/validator
- **HSTS Header** - Strict Transport Security enabled
- **Rate Limiting** - API rate limiting middleware
- **Secure IDs** - crypto.randomUUID() for all identifiers
- **Request Timeouts** - AbortController with 30s timeout on all fetches
- **Input Validation** - Zod schemas for all API inputs

## Roadmap

- [x] Multi-language support (EN, RU)
- [x] User avatar fetching and S3 storage
- [x] Smart AI trigger (@mention only)
- [ ] Push notifications for new expenses
- [ ] Recurring expense templates
- [ ] Currency conversion
- [ ] USDT Jetton support
- [ ] Group analytics dashboard
- [ ] Export to CSV/PDF

## License

MIT

---

Built for AWS + AI Hackathon 2026
