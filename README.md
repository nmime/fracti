# Fracti

**Fractionalize costs. Settle on-chain.**

Fracti is an AI-powered Telegram Mini App that turns unstructured group chat chaos into structured financial settlements using AWS Bedrock and TON blockchain.

## Features

- **AI-Powered Expense Parsing** - Natural language processing to extract expenses from chat messages
- **Receipt OCR** - Scan receipts with Claude Vision to automatically itemize expenses
- **Debt Graph Visualization** - Interactive force-directed graph showing who owes whom
- **Min-Cash-Flow Optimization** - Minimize the number of transactions needed to settle debts
- **On-Chain Settlements** - Pay debts directly with TON Connect wallet integration
- **Telegram Native** - Seamless integration as a Telegram Mini App

## Tech Stack

### Frontend (Telegram Mini App)
- **React Router v7** - Client-side routing
- **Vite** - Build tool and dev server
- **shadcn/ui** - Tailwind CSS components
- **react-force-graph-2d** - Debt web visualization
- **@twa-dev/sdk** - Telegram Mini App SDK
- **@tonconnect/ui-react** - TON wallet integration

### Backend (AWS Serverless + Hono)
- **Hono** - Lightweight web framework on Lambda
- **AWS Lambda** - Node.js 20.x (ARM64)
- **Amazon API Gateway** - HTTP API
- **Amazon DynamoDB** - Single-table design
- **AWS SAM** - Infrastructure as Code

### AI Layer
- **Amazon Bedrock** - Claude 3.5 Sonnet
- **Text Parser Agent** - Natural language to structured JSON
- **Vision Agent** - Receipt OCR and itemization

### Blockchain
- **TON Connect** - Wallet connection and transactions
- **Native TON** - Direct payments or USDT Jettons

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
│   │   └── auth.ts               # Telegram auth middleware
│   └── lib/                      # Shared utilities
│       ├── bedrock.ts            # AWS Bedrock client
│       ├── dynamodb.ts           # DynamoDB operations
│       ├── debt-graph.ts         # Min-cash-flow algorithm
│       ├── telegram.ts           # Telegram Bot API
│       └── response.ts           # HTTP response helpers
├── docs/
│   └── AWS_SETUP_GUIDE.md        # Complete AWS deployment guide
├── config/
│   └── eslint.config.js          # ESLint configuration
├── template.yaml                 # AWS SAM template
├── samconfig.toml                # SAM deployment config
└── package.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- AWS CLI configured
- AWS SAM CLI
- Telegram Bot Token (from @BotFather)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fracti.git
cd fracti

# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Deployment

```bash
# Build and deploy with SAM
npm run sam:build
npm run sam:deploy:guided
```

See [docs/AWS_SETUP_GUIDE.md](./docs/AWS_SETUP_GUIDE.md) for complete setup instructions including:
- AWS account creation
- Bedrock model access
- Telegram bot configuration
- Production deployment

## Database Schema

Single-table design in DynamoDB:

| PK | SK | Description |
|---|---|---|
| `GROUP#<id>` | `METADATA` | Group information |
| `GROUP#<id>` | `USER#<telegramId>` | User profile in group |
| `GROUP#<id>` | `TX#<timestamp>` | Expense record |
| `GROUP#<id>` | `SETTLE#<timestamp>` | Settlement record |

## API Endpoints

All routes are handled by a single Hono Lambda function.

### Groups
- `GET /api/groups` - List user's groups
- `GET /api/groups/:id` - Get group details
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

### AI
- `POST /api/ai/parse` - Parse expense from text
- `POST /api/ai/vision` - Extract items from receipt image

### Health
- `GET /api/health` - API health check

## AI Agents

### Parser Agent
Converts natural language to structured expense data:
```
Input: "I paid 50 TON for dinner with Alice and Bob"
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

```env
# Required
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TABLE_NAME=fracti-dev

# Optional
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
NODE_ENV=development

# Frontend
VITE_API_URL=https://your-api-gateway-url/dev
VITE_TON_MANIFEST_URL=https://your-domain/tonconnect-manifest.json
```

## Scripts

```bash
# Frontend
npm run dev           # Start Vite dev server
npm run build         # Build frontend for production
npm run preview       # Preview production build
npm run typecheck     # TypeScript type checking

# Backend
npm run sam:build     # Build SAM application
npm run sam:deploy    # Deploy to AWS
npm run sam:deploy:guided  # Guided deployment (first time)
npm run sam:local     # Run API locally with SAM
npm run sam:logs      # Tail Lambda logs

# Deployment
npm run deploy:frontend  # Deploy frontend to S3
npm run webhook:set      # Set Telegram webhook
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  Telegram Chat  │────▶│  Bot Webhook     │
└─────────────────┘     └────────┬─────────┘
                                 │
┌─────────────────┐     ┌────────▼─────────┐     ┌─────────────────┐
│  Mini App (UI)  │────▶│  API Gateway     │────▶│  Hono Lambda    │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                        ┌────────▼─────────┐     ┌────────▼────────┐
                        │   AWS Bedrock    │     │    DynamoDB     │
                        │  (Claude 3.5)    │     │  (Single Table) │
                        └──────────────────┘     └─────────────────┘
```

## Roadmap

- [ ] Push notifications for new expenses
- [ ] Recurring expense templates
- [ ] Currency conversion
- [ ] USDT Jetton support
- [ ] Group analytics dashboard
- [ ] Export to CSV/PDF
- [ ] Multi-language support

## License

MIT

---

Built for AWS + AI Hackathon 2026
