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
- **Vite 6** - Fast build tool with HMR
- **Tailwind CSS** + **shadcn/ui** - Beautiful, accessible components
- **react-force-graph-2d** - Interactive debt visualization
- **@twa-dev/sdk** - Official Telegram Mini App SDK
- **@tonconnect/ui-react** - TON wallet integration
- **i18next** - Internationalization (EN, RU)

### Backend
- **Hono** - Lightweight, fast web framework
- **Grammy** - Telegram Bot framework
- **AWS Lambda** - Serverless compute (Node.js 20, ARM64)
- **Amazon API Gateway** - HTTP API with CORS
- **Amazon DynamoDB** - Single-table design with GSI
- **Amazon S3** - Avatar storage with public read
- **AWS SAM** - Infrastructure as Code

### AI
- **Amazon Bedrock** - Managed AI service
- **Claude 3.5 Sonnet** - Text parsing and vision
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

Single-table design with two Global Secondary Indexes:

| PK | SK | GSI1PK | GSI1SK | GSI2PK | Description |
|---|---|---|---|---|---|
| `GROUP#<id>` | `METADATA` | - | - | - | Group info |
| `GROUP#<id>` | `USER#<tgId>` | `USER#<tgId>` | `GROUP#<id>` | - | Member with avatar |
| `GROUP#<id>` | `TX#<ts>` | - | - | `EXPENSE#<id>` | Expense record |
| `GROUP#<id>` | `SETTLE#<ts>` | - | - | `SETTLEMENT#<id>` | Settlement record |

- **GSI1**: Find all groups for a user
- **GSI2**: O(1) lookup by expense/settlement ID

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

See **[docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)** for complete instructions including:

- AWS account creation from zero
- IAM user setup with correct permissions
- Installing Node.js, AWS CLI, SAM CLI
- Creating Telegram bot with @BotFather
- Deploying to AWS with SAM
- Configuring Telegram webhook
- Enabling Bedrock model access
- Local development setup
- Troubleshooting guide

### Quick Start (if you have AWS configured)

```bash
# Clone and install
git clone https://github.com/yourusername/fracti.git
cd fracti
npm install

# Deploy
npm run sam:build
npm run sam:deploy:guided

# Set webhook
export TELEGRAM_BOT_TOKEN=your_token
npm run webhook:set
```

## Project Structure

```
fracti/
├── app/                      # React Frontend
│   ├── components/           # UI Components
│   │   ├── ui/               # shadcn/ui base components
│   │   ├── DebtGraph.tsx     # Force graph visualization
│   │   ├── ExpenseCard.tsx   # Expense display card
│   │   └── WalletButton.tsx  # TON Connect button
│   ├── routes/               # Page routes
│   │   ├── home.tsx          # Dashboard with debt graph
│   │   ├── expenses.tsx      # Expense list + add
│   │   ├── settle.tsx        # Settlements + pay
│   │   └── scan.tsx          # Receipt scanner
│   └── lib/                  # Utilities
│       ├── api.ts            # API client with types
│       ├── telegram.tsx      # Telegram SDK wrapper
│       ├── ton.ts            # TON payment utilities
│       └── i18n/             # Translations (en, ru)
├── server/                   # AWS Lambda Backend
│   ├── routes/               # API route handlers
│   ├── middleware/           # Auth, rate limiting
│   └── lib/                  # Shared utilities
│       ├── bot.ts            # Telegram bot handlers
│       ├── bedrock.ts        # Claude AI client
│       ├── dynamodb.ts       # Database operations
│       ├── s3.ts             # Avatar storage
│       └── debt-graph.ts     # Min-cash-flow algorithm
├── docs/
│   └── SETUP_GUIDE.md        # Complete setup instructions
├── template.yaml             # AWS SAM template
└── package.json
```

## Scripts

```bash
# Development
npm run dev              # Start frontend (Vite)
npm run sam:local        # Start backend (SAM + Docker)

# Build
npm run build            # Build frontend
npm run sam:build        # Build backend

# Deploy
npm run sam:deploy       # Deploy to AWS
npm run deploy:frontend  # Deploy frontend to S3
npm run webhook:set      # Configure Telegram webhook

# Quality
npm run typecheck        # TypeScript check
npm run lint             # ESLint
npm run test             # Vitest
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | - | Bot token from @BotFather |
| `TABLE_NAME` | Yes | - | DynamoDB table name |
| `S3_BUCKET_NAME` | Yes | - | S3 bucket for avatars |
| `BEDROCK_MODEL_ID` | No | claude-3-5-sonnet | Claude model ID |
| `AWS_REGION` | No | us-east-1 | AWS region |
| `NODE_ENV` | No | production | Environment mode |
| `MINI_APP_URL` | No | - | Telegram Mini App URL |
| `ALLOWED_ORIGINS` | No | telegram.org | CORS origins |

## Roadmap

- [x] AI-powered expense parsing
- [x] Receipt OCR with Claude Vision
- [x] Automatic user tracking (all messages)
- [x] User avatar fetching and S3 storage
- [x] Smart AI trigger (@mention only)
- [x] Multi-language support (EN, RU)
- [x] TON Connect wallet integration
- [x] Min-cash-flow debt optimization
- [x] Interactive debt graph visualization
- [ ] Push notifications for new expenses
- [ ] Recurring expense templates
- [ ] Currency conversion
- [ ] USDT Jetton support
- [ ] Group analytics dashboard
- [ ] Export to CSV/PDF
- [ ] Telegram Mini App inline mode

## License

MIT

---

Built for AWS + AI Hackathon 2026
