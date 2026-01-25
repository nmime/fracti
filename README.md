# Fracti

**Fractionalize costs. Settle on-chain.**

Fracti is an AI-powered Telegram Mini App that turns unstructured group chat chaos into structured financial settlements using AWS Bedrock and TON blockchain.

## Features

### Telegram Bot

| Feature | Description |
|---------|-------------|
| **Automatic User Tracking** | Bot captures ALL group messages to automatically track members - no manual registration needed |
| **User Avatars** | Automatically fetches Telegram profile photos and stores them in S3 for display in the app |
| **Smart AI Trigger** | AI expense parsing only activates when bot is @mentioned - no spam, no false positives |
| **Natural Language Parsing** | Just write naturally: `@FractiBot I paid 100 for dinner with @alice and @bob` |
| **Receipt OCR** | Send a photo of any receipt - Claude Vision extracts merchant, items, and totals automatically |
| **Multi-language** | Full support for English and Russian, auto-detects from Telegram language settings |

### Expense Management

| Feature | Description |
|---------|-------------|
| **Equal Split** | Automatically divide expenses equally among selected participants |
| **Custom Split** | Assign specific amounts or percentages to each person |
| **Expense History** | Full searchable history with filters (all, mine, I owe) |
| **Edit & Delete** | Modify or remove expenses with full audit trail |
| **Categories** | AI automatically categorizes expenses (food, transport, entertainment, etc.) |

### Debt Optimization

| Feature | Description |
|---------|-------------|
| **Debt Graph Visualization** | Interactive force-directed graph showing who owes whom |
| **Min-Cash-Flow Algorithm** | Minimizes number of transactions needed to settle all debts |
| **Balance Summary** | Real-time view of what you owe and what you're owed |
| **Settlement Suggestions** | Automatically suggests optimal payment paths |

### TON Blockchain Payments

| Feature | Description |
|---------|-------------|
| **TON Connect Integration** | Connect any TON wallet (Tonkeeper, OpenMask, MyTonWallet) |
| **One-Click Payments** | Pay debts directly from the app with a single tap |
| **Transaction Tracking** | All settlements recorded with blockchain transaction hash |
| **Payment Confirmation** | Automatic status updates when payments complete |

### Security & Privacy

| Feature | Description |
|---------|-------------|
| **Telegram Auth Validation** | All API requests validated using official Telegram init data |
| **HSTS Enabled** | Strict Transport Security for all connections |
| **Secure IDs** | `crypto.randomUUID()` for all identifiers |
| **Request Timeouts** | AbortController with 30s timeout prevents hanging requests |
| **Input Validation** | Zod schemas validate all API inputs |
| **Rate Limiting** | Built-in rate limiting to prevent abuse |

## How It Works

### Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         GROUP CHAT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Alice: "Hey everyone!"                                          │
│         ↓                                                        │
│         Bot: [silently registers Alice + fetches avatar]         │
│                                                                  │
│  Bob: "Let's get pizza"                                          │
│       ↓                                                          │
│       Bot: [silently registers Bob + fetches avatar]             │
│                                                                  │
│  Alice: "@FractiBot I paid 45 for pizza, split with Bob"         │
│         ↓                                                        │
│         Bot: Parses with Claude AI                               │
│         ↓                                                        │
│         Bot: "✅ Expense created: pizza (45 TON)                 │
│               Paid by Alice, split 2 ways (22.50 each)"          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Avatar System

```
User sends message
       ↓
Check DynamoDB: has avatar?
       ↓ no
Telegram API: getUserProfilePhotos
       ↓
Download largest photo
       ↓
Upload to S3: avatars/{telegramId}.jpg
       ↓
Store relative path in DynamoDB
       ↓
API transforms to full S3 URL on read
```

### AI Expense Parsing

```
Input:  "@FractiBot I paid 50 TON for dinner with Alice and Bob"

Claude AI extracts:
{
  "payer": null,           // null = message sender
  "amount": 50,
  "currency": "TON",
  "description": "dinner",
  "beneficiaries": ["Alice", "Bob"],
  "splitType": "equal",
  "confidence": 0.95
}

Result: Expense created, split 3 ways (16.67 TON each)
```

### Receipt Vision

```
Input: [Photo of restaurant receipt]

Claude Vision extracts:
{
  "merchant": "Pizza Palace",
  "date": "2026-01-15",
  "items": [
    {"name": "Margherita Pizza", "quantity": 1, "price": 12.00},
    {"name": "Pepperoni Pizza", "quantity": 1, "price": 14.00},
    {"name": "Drinks", "quantity": 3, "price": 9.00}
  ],
  "subtotal": 35.00,
  "tax": 3.15,
  "total": 38.15,
  "currency": "USD",
  "confidence": 0.94
}
```

### Min-Cash-Flow Algorithm

Before optimization:
```
Alice owes Bob: $30
Bob owes Carol: $30
Carol owes Alice: $10
```

After optimization:
```
Alice pays Carol: $20
```

One transaction instead of three!

## Tech Stack

### Frontend
- **React 19** + **React Router 7** - Modern React with file-based routing
- **Vite 7** - Fast build tool with HMR
- **Tailwind CSS 4** + **shadcn/ui** - Beautiful, accessible components
- **react-force-graph-2d** - Interactive debt visualization
- **@twa-dev/sdk** - Official Telegram Mini App SDK
- **@tonconnect/ui-react** - TON wallet integration
- **i18next** - Internationalization (EN, RU)
- **TanStack Query** - Server state management

### Backend
- **Hono** - Lightweight, fast web framework
- **Grammy** - Telegram Bot framework
- **AWS Lambda** - Serverless compute (Node.js 22, ARM64)
- **Amazon API Gateway** - HTTP API with CORS
- **Amazon DynamoDB** - Single-table design with 3 GSIs
- **Amazon S3** - Avatar storage with public read
- **AWS CDK** - Infrastructure as Code

### AI
- **Amazon Bedrock** - Managed AI service
- **Claude Sonnet 4** - Text parsing and vision
- **Custom prompts** - Optimized for expense extraction

### Blockchain
- **TON Connect 2.0** - Wallet connection protocol
- **Native TON** - Direct cryptocurrency payments

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Telegram Chat  │────▶│  Bot Webhook     │────▶│ Register User   │
│  (ALL messages) │     │  (Grammy)        │     │ + Fetch Avatar  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                 ┌────────▼────────┐
                                                 │  @mention?      │
                                                 └────────┬────────┘
                                                          │ yes
┌─────────────────┐     ┌──────────────────┐     ┌────────▼────────┐
│  Mini App (UI)  │────▶│  API Gateway     │────▶│  Hono Lambda    │
│  React + Vite   │     │  HTTP API        │     │  (Node.js 20)   │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────────────┐
                        │                                 │                                 │
               ┌────────▼────────┐               ┌────────▼────────┐               ┌────────▼────────┐
               │  AWS Bedrock    │               │    DynamoDB     │               │   S3 Avatars    │
               │  Claude 3.5     │               │  Single Table   │               │  Public Read    │
               └─────────────────┘               └─────────────────┘               └─────────────────┘
```

## Database Schema

Single-table design with three Global Secondary Indexes:

| PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI3PK | Description |
|---|---|---|---|---|---|---|
| `GROUP#<id>` | `METADATA` | - | - | - | - | Group info |
| `GROUP#<id>` | `USER#<tgId>` | `USER#<tgId>` | `GROUP#<id>` | - | - | Member with avatar |
| `GROUP#<id>` | `TX#<ts>` | - | - | `EXPENSE#<id>` | `USER#<payerId>` | Expense record |
| `GROUP#<id>` | `SETTLE#<ts>` | - | - | `SETTLEMENT#<id>` | `USER#<fromId>` | Settlement record |
| `GROUP#<id>` | `PART#<expId>#<userId>` | `USER#<userId>` | `OWES#<ts>` | - | - | Expense participant |

- **GSI1**: Find all groups for a user, find expenses user owes
- **GSI2**: O(1) lookup by expense/settlement ID
- **GSI3**: User activity timeline (expenses paid, settlements made)

See **[docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)** for complete schema documentation.

## API Endpoints

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List user's groups |
| GET | `/api/groups/:id` | Get group with members (includes avatarUrl) |
| POST | `/api/groups` | Create new group |
| POST | `/api/groups/:id/join` | Join a group |
| PUT | `/api/groups/:id/wallet` | Update wallet address |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/:id/expenses` | List expenses (paginated) |
| POST | `/api/groups/:id/expenses` | Create expense |
| DELETE | `/api/groups/:id/expenses/:eid` | Delete expense |

### Settlements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups/:id/debts` | Get debt graph + suggested settlements |
| GET | `/api/groups/:id/settlements` | List settlements |
| POST | `/api/groups/:id/settlements` | Record new settlement |
| PUT | `/api/groups/:id/settlements/:sid` | Confirm with tx hash |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/parse` | Parse expense from natural language |
| POST | `/api/ai/vision` | Extract data from receipt image |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/telegram` | Telegram bot updates |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | API health check |

## Setup & Deployment

### Prerequisites

- Node.js 22+
- pnpm 10+
- AWS CLI configured with credentials
- Telegram bot token from @BotFather

### Environment Setup

Create a `.env` file in the project root:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_SESSION_TOKEN=your_session_token  # if using temporary credentials
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
MINI_APP_URL=https://t.me/YourBot/app
```

### Quick Deploy

```bash
# Install dependencies
pnpm install

# Deploy everything (builds, deploys CDK, configures bot, uploads frontend)
./scripts/deploy.sh
```

### Manual Deployment Steps

```bash
# 1. Install dependencies
pnpm install

# 2. Build all packages
pnpm build

# 3. Bootstrap CDK (first time only)
cd infra/cdk && pnpm exec cdk bootstrap

# 4. Deploy infrastructure
pnpm exec cdk deploy --all --require-approval never

# 5. Configure bot webhook (uses CDK outputs)
export WEBHOOK_URL="<BotFunctionUrl from CDK output>/webhook"
pnpm exec tsx scripts/setup.ts

# 6. Upload frontend assets
aws s3 sync gui/react/build/client s3://<FrontendBucketName from CDK output> --delete

# 7. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id <CloudFrontDistributionId> --paths "/*"
```

### CDK Stack Outputs

After deployment, CDK provides these outputs:

| Output | Description |
|--------|-------------|
| `BotFunctionUrl` | Lambda URL for bot webhook |
| `GuiFunctionUrl` | Lambda URL for SSR |
| `ApiFunctionUrl` | Lambda URL for API |
| `CloudFrontDomain` | CDN domain for the app |
| `CloudFrontDistributionId` | For cache invalidation |
| `FrontendBucketName` | S3 bucket for static assets |
| `AvatarsBucketName` | S3 bucket for user avatars |
| `TableName` | DynamoDB table name |
| `TelegramWebhookUrl` | Full webhook URL to register |

### Local Development

```bash
# Start frontend dev server
pnpm dev

# Start bot in polling mode (for local testing)
pnpm dev:bot
```

## Project Structure

```
fracti/                       # pnpm Monorepo
├── apps/                     # Applications
│   ├── bot/                  # Telegram Bot (Grammy)
│   │   ├── config/           # Bot configuration
│   │   ├── handlers/         # Command & message handlers
│   │   ├── services/         # Business logic (AI, expenses, users)
│   │   ├── integrations/     # External services (Bedrock, S3, Telegram)
│   │   ├── schemas/          # Zod validation schemas
│   │   ├── types/            # TypeScript type definitions
│   │   ├── utils/            # Utilities (cache, retry, currency)
│   │   ├── i18n/             # Internationalization (EN, RU)
│   │   ├── bot.ts            # Bot creation & lazy init
│   │   ├── lambda.ts         # Lambda webhook handler
│   │   └── index.ts          # Exports
│   │
│   ├── web/                  # React Frontend (React Router 7)
│   │   └── app/
│   │       ├── providers/    # Context providers (Auth, Theme, Group, Telegram)
│   │       ├── services/     # API client
│   │       ├── hooks/        # Custom hooks (useTonPayment)
│   │       ├── utils/        # Utilities (cn, format, logger)
│   │       ├── constants/    # App constants (TON)
│   │       ├── config/       # Validated configuration
│   │       ├── features/     # Feature components (expenses, settlements)
│   │       ├── components/   # Shared UI components (shadcn/ui)
│   │       ├── fixtures/     # Demo data for development
│   │       └── routes/       # Page routes
│   │
│   └── server/               # Hono API Server
│       ├── routes/           # Route definitions
│       ├── controllers/      # Request handlers
│       ├── services/         # Business logic
│       ├── repositories/     # Data access layer
│       ├── schemas/          # Zod validation schemas
│       ├── middleware/       # Auth, rate limiting
│       ├── integrations/     # External services
│       ├── types/            # TypeScript types
│       └── utils/            # Utilities
│
├── core/                     # Shared Core Packages
│   ├── constants/            # App-wide constants
│   ├── db/                   # DynamoDB single-table utilities
│   ├── session/              # Session management
│   ├── tools/                # JSON extraction, utilities
│   ├── types/                # TypeScript types
│   └── vault/                # Bot token/info retrieval
│
├── infra/cdk/                # AWS CDK Infrastructure
│   ├── bin/infra.ts          # CDK app entry
│   ├── lib/stacks/           # CDK stacks
│   └── scripts/setup.ts      # Bot webhook configuration
│
├── scripts/                  # Utility scripts
│   └── deploy.sh             # Full deployment script
├── tests/                    # Test files
│   ├── gui/                  # Frontend tests
│   └── server/               # API tests
├── e2e/                      # Playwright E2E Tests
├── .env                      # Environment variables (not committed)
├── app.yaml                  # App configuration
└── pnpm-workspace.yaml       # Workspace config
```

## Scripts

```bash
# Full Deployment
./scripts/deploy.sh      # Deploy everything (build + CDK + bot setup + S3)

# Development
pnpm dev                 # Start frontend (React Router dev server)
pnpm dev:bot             # Start bot in polling mode

# Build
pnpm build               # Build all packages
pnpm build:gui           # Build frontend only
pnpm build:bot           # Build bot only

# CDK Commands (from infra/cdk/)
pnpm exec cdk bootstrap  # Bootstrap AWS account (first time)
pnpm exec cdk synth      # Generate CloudFormation template
pnpm exec cdk deploy     # Deploy all stacks

# Post-Deploy Setup (from infra/cdk/)
pnpm exec tsx scripts/setup.ts   # Configure Telegram webhook

# Quality
pnpm typecheck           # TypeScript check (all packages)
pnpm lint                # ESLint
pnpm test                # Vitest unit tests
pnpm test:run            # Run tests once
pnpm test:coverage       # Run tests with coverage
pnpm test:e2e            # Playwright E2E tests
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Bot token from @BotFather |
| `TABLE_NAME` | Auto | - | DynamoDB table name (set by CDK) |
| `S3_BUCKET_NAME` | Auto | - | S3 bucket for avatars (set by CDK) |
| `BEDROCK_MODEL_ID` | No | claude-sonnet-4 | Claude model ID |
| `AWS_REGION` | No | us-east-1 | AWS region |
| `NODE_ENV` | No | production | Environment mode |
| `MINI_APP_URL` | No | - | Telegram Mini App URL |
| `VITE_API_URL` | No | /api | API base URL for frontend |
| `VITE_TONCONNECT_MANIFEST_URL` | No | - | TON Connect manifest URL |

## Roadmap

- [x] AI-powered expense parsing (Claude via Bedrock)
- [x] Receipt OCR with Claude Vision
- [x] Automatic user tracking (all messages)
- [x] User avatar fetching and S3 storage
- [x] Smart AI trigger (@mention only)
- [x] Multi-language support (EN, RU)
- [x] TON Connect wallet integration
- [x] Min-cash-flow debt optimization
- [x] Interactive debt graph visualization
- [x] Group context management
- [x] Real API integration (removed demo fixtures)
- [x] SSR-safe client-only components
- [x] Comprehensive test coverage
- [x] One-command deployment script
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
