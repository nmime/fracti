# Fracti Database Schema

## Overview

Fracti uses a **single-table DynamoDB design** optimized for an expense-splitting application. This design enables efficient queries for both group-centric and user-centric access patterns.

## Table Structure

| Component         | Value             | Description                   |
| ----------------- | ----------------- | ----------------------------- |
| **Table Name**    | `FractiTable`     | Single table for all entities |
| **Partition Key** | `PK` (String)     | Entity partition              |
| **Sort Key**      | `SK` (String)     | Entity type + identifier      |
| **Billing Mode**  | `PAY_PER_REQUEST` | On-demand scaling             |

## Global Secondary Indexes

### GSI1: User Index

| Attribute | Type   | Description           |
| --------- | ------ | --------------------- |
| `GSI1PK`  | String | `USER#<telegramId>`   |
| `GSI1SK`  | String | Varies by entity type |

**Purpose**:

- Find all groups for a user (`GSI1SK` begins with `GROUP#`)
- Find all expenses where user is a beneficiary (`GSI1SK` begins with `OWES#`)

### GSI2: Entity Lookup Index

| Attribute | Type   | Description                         |
| --------- | ------ | ----------------------------------- |
| `GSI2PK`  | String | `EXPENSE#<id>` or `SETTLEMENT#<id>` |
| `GSI2SK`  | String | `<groupId>`                         |

**Purpose**: O(1) lookup by expense or settlement ID

### GSI3: User Activity Index

| Attribute | Type   | Description                |
| --------- | ------ | -------------------------- |
| `GSI3PK`  | String | `USER#<telegramId>`        |
| `GSI3SK`  | String | `TX#<ts>` or `SETTLE#<ts>` |

**Purpose**:

- Find all expenses paid by a user
- Find all settlements made by a user
- Get user activity timeline

---

## Entity Definitions

### 1. GROUP

Represents a Telegram group/chat where expenses are tracked.

| Attribute     | Key | Type   | Description                       |
| ------------- | --- | ------ | --------------------------------- |
| `PK`          | PK  | String | `GROUP#<id>`                      |
| `SK`          | SK  | String | `METADATA`                        |
| `id`          |     | String | UUID                              |
| `chatId`      |     | String | Telegram chat ID                  |
| `title`       |     | String | Group name                        |
| `currency`    |     | String | Default currency (TON, USD, etc.) |
| `createdAt`   |     | String | ISO timestamp                     |
| `memberCount` |     | Number | Cached member count               |

**Example:**

```json
{
  "PK": "GROUP#550e8400-e29b-41d4-a716-446655440000",
  "SK": "METADATA",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "chatId": "-1001234567890",
  "title": "Roommates",
  "currency": "TON",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "memberCount": 4
}
```

---

### 2. MEMBER

Represents a user's membership in a group.

| Attribute    | Key  | Type   | Description               |
| ------------ | ---- | ------ | ------------------------- |
| `PK`         | PK   | String | `GROUP#<groupId>`         |
| `SK`         | SK   | String | `USER#<telegramId>`       |
| `GSI1PK`     | GSI1 | String | `USER#<telegramId>`       |
| `GSI1SK`     | GSI1 | String | `GROUP#<groupId>`         |
| `id`         |      | String | Telegram user ID (string) |
| `telegramId` |      | Number | Telegram user ID (number) |
| `name`       |      | String | Display name              |
| `username`   |      | String | Telegram @username        |
| `wallet`     |      | String | TON wallet address        |
| `avatarUrl`  |      | String | S3 avatar path            |
| `joinedAt`   |      | String | ISO timestamp             |

**Example:**

```json
{
  "PK": "GROUP#550e8400-e29b-41d4-a716-446655440000",
  "SK": "USER#123456789",
  "GSI1PK": "USER#123456789",
  "GSI1SK": "GROUP#550e8400-e29b-41d4-a716-446655440000",
  "id": "123456789",
  "telegramId": 123456789,
  "name": "Alice Smith",
  "username": "alice",
  "wallet": "EQBvI0aFLnw2XHNc7mpXc...",
  "avatarUrl": "avatars/123456789.jpg",
  "joinedAt": "2024-01-15T10:35:00.000Z"
}
```

---

### 3. EXPENSE

Represents a shared expense within a group.

| Attribute     | Key  | Type   | Description                       |
| ------------- | ---- | ------ | --------------------------------- |
| `PK`          | PK   | String | `GROUP#<groupId>`                 |
| `SK`          | SK   | String | `TX#<timestamp>`                  |
| `GSI2PK`      | GSI2 | String | `EXPENSE#<id>`                    |
| `GSI2SK`      | GSI2 | String | `<groupId>`                       |
| `GSI3PK`      | GSI3 | String | `USER#<payerId>`                  |
| `GSI3SK`      | GSI3 | String | `TX#<timestamp>`                  |
| `id`          |      | String | UUID                              |
| `groupId`     |      | String | Group UUID                        |
| `payerId`     |      | String | Telegram ID of payer              |
| `payerName`   |      | String | Display name of payer             |
| `amount`      |      | Number | Total expense amount              |
| `currency`    |      | String | Currency code                     |
| `description` |      | String | Expense description               |
| `splitType`   |      | String | `equal`, `exact`, or `percentage` |
| `splits`      |      | Array  | Split breakdown                   |
| `category`    |      | String | Expense category                  |
| `createdAt`   |      | String | ISO timestamp                     |

**Splits Array Structure:**

```typescript
{
  userId: string;     // Telegram ID
  userName: string;   // Display name
  amount: number;     // Amount owed
  percentage?: number; // If split by percentage
}
```

**Example:**

```json
{
  "PK": "GROUP#550e8400-e29b-41d4-a716-446655440000",
  "SK": "TX#2024-01-20T18:30:00.000Z",
  "GSI2PK": "EXPENSE#660e8400-e29b-41d4-a716-446655440001",
  "GSI2SK": "550e8400-e29b-41d4-a716-446655440000",
  "GSI3PK": "USER#123456789",
  "GSI3SK": "TX#2024-01-20T18:30:00.000Z",
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440000",
  "payerId": "123456789",
  "payerName": "Alice Smith",
  "amount": 100,
  "currency": "TON",
  "description": "Dinner at restaurant",
  "splitType": "equal",
  "splits": [
    { "userId": "123456789", "userName": "Alice Smith", "amount": 25 },
    { "userId": "987654321", "userName": "Bob Jones", "amount": 25 },
    { "userId": "456789123", "userName": "Carol White", "amount": 25 },
    { "userId": "789123456", "userName": "Dave Brown", "amount": 25 }
  ],
  "category": "food",
  "createdAt": "2024-01-20T18:30:00.000Z"
}
```

---

### 4. EXPENSE_PARTICIPANT

Denormalized record for querying expenses where a user owes money (beneficiary queries).

| Attribute     | Key  | Type   | Description                 |
| ------------- | ---- | ------ | --------------------------- |
| `PK`          | PK   | String | `GROUP#<groupId>`           |
| `SK`          | SK   | String | `PART#<expenseId>#<userId>` |
| `GSI1PK`      | GSI1 | String | `USER#<userId>`             |
| `GSI1SK`      | GSI1 | String | `OWES#<timestamp>`          |
| `expenseId`   |      | String | Expense UUID                |
| `groupId`     |      | String | Group UUID                  |
| `groupTitle`  |      | String | Group name (denormalized)   |
| `userId`      |      | String | Beneficiary Telegram ID     |
| `userName`    |      | String | Beneficiary name            |
| `amount`      |      | Number | Amount this user owes       |
| `payerId`     |      | String | Who paid                    |
| `payerName`   |      | String | Payer name                  |
| `description` |      | String | Expense description         |
| `totalAmount` |      | Number | Total expense amount        |
| `createdAt`   |      | String | ISO timestamp               |

**Example:**

```json
{
  "PK": "GROUP#550e8400-e29b-41d4-a716-446655440000",
  "SK": "PART#660e8400-e29b-41d4-a716-446655440001#987654321",
  "GSI1PK": "USER#987654321",
  "GSI1SK": "OWES#2024-01-20T18:30:00.000Z",
  "expenseId": "660e8400-e29b-41d4-a716-446655440001",
  "groupId": "550e8400-e29b-41d4-a716-446655440000",
  "groupTitle": "Roommates",
  "userId": "987654321",
  "userName": "Bob Jones",
  "amount": 25,
  "payerId": "123456789",
  "payerName": "Alice Smith",
  "description": "Dinner at restaurant",
  "totalAmount": 100,
  "createdAt": "2024-01-20T18:30:00.000Z"
}
```

---

### 5. SETTLEMENT

Represents a payment between two users to settle debt.

| Attribute      | Key  | Type   | Description                      |
| -------------- | ---- | ------ | -------------------------------- |
| `PK`           | PK   | String | `GROUP#<groupId>`                |
| `SK`           | SK   | String | `SETTLE#<timestamp>`             |
| `GSI2PK`       | GSI2 | String | `SETTLEMENT#<id>`                |
| `GSI2SK`       | GSI2 | String | `<groupId>`                      |
| `GSI3PK`       | GSI3 | String | `USER#<fromUserId>`              |
| `GSI3SK`       | GSI3 | String | `SETTLE#<timestamp>`             |
| `id`           |      | String | UUID                             |
| `groupId`      |      | String | Group UUID                       |
| `fromUserId`   |      | String | Payer Telegram ID                |
| `fromUserName` |      | String | Payer name                       |
| `toUserId`     |      | String | Recipient Telegram ID            |
| `toUserName`   |      | String | Recipient name                   |
| `amount`       |      | Number | Settlement amount                |
| `currency`     |      | String | Currency code                    |
| `txHash`       |      | String | TON transaction hash             |
| `status`       |      | String | `pending`, `completed`, `failed` |
| `createdAt`    |      | String | ISO timestamp                    |
| `completedAt`  |      | String | Completion timestamp             |

**Example:**

```json
{
  "PK": "GROUP#550e8400-e29b-41d4-a716-446655440000",
  "SK": "SETTLE#2024-01-21T10:00:00.000Z",
  "GSI2PK": "SETTLEMENT#770e8400-e29b-41d4-a716-446655440002",
  "GSI2SK": "550e8400-e29b-41d4-a716-446655440000",
  "GSI3PK": "USER#987654321",
  "GSI3SK": "SETTLE#2024-01-21T10:00:00.000Z",
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "groupId": "550e8400-e29b-41d4-a716-446655440000",
  "fromUserId": "987654321",
  "fromUserName": "Bob Jones",
  "toUserId": "123456789",
  "toUserName": "Alice Smith",
  "amount": 25,
  "currency": "TON",
  "txHash": "a1b2c3d4e5f6...",
  "status": "completed",
  "createdAt": "2024-01-21T10:00:00.000Z",
  "completedAt": "2024-01-21T10:00:05.000Z"
}
```

---

## Access Patterns

### Group-Centric Patterns

| #   | Pattern                   | Index | Key Condition                                    | Complexity |
| --- | ------------------------- | ----- | ------------------------------------------------ | ---------- |
| 1   | Get group by ID           | Main  | `PK = GROUP#<id>`, `SK = METADATA`               | O(1)       |
| 2   | Get all members in group  | Main  | `PK = GROUP#<id>`, `SK begins_with USER#`        | O(log n)   |
| 3   | Get member by ID in group | Main  | `PK = GROUP#<id>`, `SK = USER#<tgId>`            | O(1)       |
| 4   | Get expenses in group     | Main  | `PK = GROUP#<id>`, `SK begins_with TX#`          | O(log n)   |
| 5   | Get settlements in group  | Main  | `PK = GROUP#<id>`, `SK begins_with SETTLE#`      | O(log n)   |
| 6   | Get expense participants  | Main  | `PK = GROUP#<id>`, `SK begins_with PART#<expId>` | O(log n)   |

### Entity Lookup Patterns

| #   | Pattern              | Index | Key Condition              | Complexity |
| --- | -------------------- | ----- | -------------------------- | ---------- |
| 7   | Get expense by ID    | GSI2  | `GSI2PK = EXPENSE#<id>`    | O(1)       |
| 8   | Get settlement by ID | GSI2  | `GSI2PK = SETTLEMENT#<id>` | O(1)       |

### User-Centric Patterns

| #   | Pattern                   | Index | Key Condition                                  | Complexity |
| --- | ------------------------- | ----- | ---------------------------------------------- | ---------- |
| 9   | Get all groups for user   | GSI1  | `GSI1PK = USER#<id>`, `SK begins_with GROUP#`  | O(log n)   |
| 10  | Get expenses user owes    | GSI1  | `GSI1PK = USER#<id>`, `SK begins_with OWES#`   | O(log n)   |
| 11  | Get expenses user paid    | GSI3  | `GSI3PK = USER#<id>`, `SK begins_with TX#`     | O(log n)   |
| 12  | Get settlements user made | GSI3  | `GSI3PK = USER#<id>`, `SK begins_with SETTLE#` | O(log n)   |
| 13  | Get all user activity     | GSI3  | `GSI3PK = USER#<id>`                           | O(log n)   |

---

## Visual Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MAIN TABLE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  PK = GROUP#abc123                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ SK = METADATA              → Group info (title, currency, etc.)         ││
│  │ SK = USER#111              → Alice (member, GSI1→groups, GSI1→debts)    ││
│  │ SK = USER#222              → Bob (member)                               ││
│  │ SK = USER#333              → Carol (member)                             ││
│  │ SK = TX#2024-01-20T18:30   → Expense $100 (GSI2→id, GSI3→payer)         ││
│  │ SK = TX#2024-01-21T12:00   → Expense $50 (GSI2→id, GSI3→payer)          ││
│  │ SK = PART#exp1#222         → Bob owes $25 on exp1 (GSI1→owes)           ││
│  │ SK = PART#exp1#333         → Carol owes $25 on exp1 (GSI1→owes)         ││
│  │ SK = SETTLE#2024-01-22     → Settlement $25 (GSI2→id, GSI3→payer)       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  GSI1: User Index                       │
│  GSI1PK = USER#222 (Bob)                │
│  ┌─────────────────────────────────────┐│
│  │ GSI1SK = GROUP#abc123  → Membership ││
│  │ GSI1SK = GROUP#def456  → Membership ││
│  │ GSI1SK = OWES#2024-01-20 → Owes $25 ││
│  │ GSI1SK = OWES#2024-01-21 → Owes $15 ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  GSI2: Entity Lookup                    │
│  ┌─────────────────────────────────────┐│
│  │ GSI2PK = EXPENSE#exp1    → O(1)     ││
│  │ GSI2PK = SETTLEMENT#stl1 → O(1)     ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  GSI3: User Activity                    │
│  GSI3PK = USER#111 (Alice)              │
│  ┌─────────────────────────────────────┐│
│  │ GSI3SK = TX#2024-01-20   → Paid $100││
│  │ GSI3SK = TX#2024-01-21   → Paid $50 ││
│  │ GSI3SK = SETTLE#2024-01  → Sent $25 ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

---

## API Endpoints

### Group Endpoints

| Method | Endpoint                      | Description            |
| ------ | ----------------------------- | ---------------------- |
| GET    | `/api/groups`                 | List user's groups     |
| GET    | `/api/groups/:groupId`        | Get group with members |
| POST   | `/api/groups`                 | Create new group       |
| POST   | `/api/groups/:groupId/join`   | Join a group           |
| PUT    | `/api/groups/:groupId/wallet` | Update wallet address  |

### Expense Endpoints

| Method | Endpoint                                   | Description                     |
| ------ | ------------------------------------------ | ------------------------------- |
| GET    | `/api/groups/:groupId/expenses`            | List group expenses (paginated) |
| GET    | `/api/groups/:groupId/expenses/:expenseId` | Get single expense              |
| POST   | `/api/groups/:groupId/expenses`            | Create expense                  |
| DELETE | `/api/groups/:groupId/expenses/:expenseId` | Delete expense                  |

### Settlement Endpoints

| Method | Endpoint                                         | Description                  |
| ------ | ------------------------------------------------ | ---------------------------- |
| GET    | `/api/groups/:groupId/debts`                     | Calculate debt graph         |
| GET    | `/api/groups/:groupId/settlements`               | List settlements (paginated) |
| POST   | `/api/groups/:groupId/settlements`               | Create settlement            |
| PUT    | `/api/groups/:groupId/settlements/:settlementId` | Update settlement            |

### User Endpoints (NEW)

| Method | Endpoint                    | Description                        |
| ------ | --------------------------- | ---------------------------------- |
| GET    | `/api/users/me`             | Get current user profile           |
| GET    | `/api/users/me/expenses`    | Expenses user paid (all groups)    |
| GET    | `/api/users/me/debts`       | Expenses user owes (all groups)    |
| GET    | `/api/users/me/settlements` | Settlements user made (all groups) |
| GET    | `/api/users/me/activity`    | Combined activity feed             |
| GET    | `/api/users/me/summary`     | Financial summary                  |

---

## Data Consistency

### Expense Creation Flow

When creating an expense, the following items are written atomically:

1. **EXPENSE record** - Main expense with GSI2 + GSI3 keys
2. **EXPENSE_PARTICIPANT records** - One per beneficiary (excluding payer) with GSI1 keys

### Expense Deletion Flow

When deleting an expense:

1. Delete the **EXPENSE record**
2. Delete all **EXPENSE_PARTICIPANT records** for that expense

### Transaction Handling

- Use `TransactWriteItems` for atomic operations across multiple items
- Implements optimistic locking where necessary

---

## Infrastructure Requirements

### DynamoDB Table Definition

```typescript
{
  TableName: "FractiTable",
  KeySchema: [
    { AttributeName: "PK", KeyType: "HASH" },
    { AttributeName: "SK", KeyType: "RANGE" }
  ],
  AttributeDefinitions: [
    { AttributeName: "PK", AttributeType: "S" },
    { AttributeName: "SK", AttributeType: "S" },
    { AttributeName: "GSI1PK", AttributeType: "S" },
    { AttributeName: "GSI1SK", AttributeType: "S" },
    { AttributeName: "GSI2PK", AttributeType: "S" },
    { AttributeName: "GSI2SK", AttributeType: "S" },
    { AttributeName: "GSI3PK", AttributeType: "S" },
    { AttributeName: "GSI3SK", AttributeType: "S" }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "GSI1",
      KeySchema: [
        { AttributeName: "GSI1PK", KeyType: "HASH" },
        { AttributeName: "GSI1SK", KeyType: "RANGE" }
      ],
      Projection: { ProjectionType: "ALL" }
    },
    {
      IndexName: "GSI2",
      KeySchema: [
        { AttributeName: "GSI2PK", KeyType: "HASH" },
        { AttributeName: "GSI2SK", KeyType: "RANGE" }
      ],
      Projection: { ProjectionType: "ALL" }
    },
    {
      IndexName: "GSI3",
      KeySchema: [
        { AttributeName: "GSI3PK", KeyType: "HASH" },
        { AttributeName: "GSI3SK", KeyType: "RANGE" }
      ],
      Projection: { ProjectionType: "ALL" }
    }
  ],
  BillingMode: "PAY_PER_REQUEST"
}
```

---

## Migration Notes

When migrating from the previous schema:

1. **Add GSI3** - New index for user activity queries
2. **Backfill EXPENSE_PARTICIPANT records** - For existing expenses
3. **Add GSI3PK/GSI3SK** to existing EXPENSE and SETTLEMENT records

Migration script should:

1. Scan all existing expenses
2. For each expense, create EXPENSE_PARTICIPANT records for non-payer beneficiaries
3. Update expenses with GSI3PK/GSI3SK attributes
4. Update settlements with GSI3PK/GSI3SK attributes
