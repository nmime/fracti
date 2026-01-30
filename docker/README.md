# Fracti Self-Hosted Deployment

This guide explains how to deploy Fracti on your own infrastructure using Docker.

## Prerequisites

- Docker & Docker Compose
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Anthropic API Key (from [console.anthropic.com](https://console.anthropic.com))
- Domain with SSL certificate (for production)

## Quick Start

1. **Copy environment file:**
   ```bash
   cp .env.docker .env
   ```

2. **Edit `.env` with your values:**
   ```bash
   # Required
   TELEGRAM_BOT_TOKEN=your_bot_token
   MINI_APP_URL=https://t.me/YourBot/app
   APP_URL=https://your-domain.com
   ANTHROPIC_API_KEY=sk-ant-...

   # Optional - change MinIO password
   MINIO_ROOT_PASSWORD=your-secure-password
   ```

3. **Start infrastructure:**
   ```bash
   docker-compose -f docker-compose.infra.yml up -d
   ```

4. **Start apps:**
   ```bash
   docker-compose up -d
   ```

5. **Or run everything together:**
   ```bash
   docker-compose -f docker-compose.infra.yml -f docker-compose.yml up -d
   ```

6. **Verify services are running:**
   ```bash
   docker-compose -f docker-compose.infra.yml ps
   docker-compose ps
   ```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx (80/443)                       │
│                     Reverse Proxy + SSL                      │
└─────────────────────┬───────────────────┬───────────────────┘
                      │                   │
          ┌───────────┴───────┐   ┌───────┴───────────┐
          │   Web (3000)      │   │   Server (3001)   │
          │   React Router    │   │   Hono REST API   │
          │   SSR Frontend    │   │                   │
          └───────────────────┘   └─────────┬─────────┘
                                            │
┌───────────────────────────────────────────┼─────────────────┐
│                                           │                  │
│  ┌─────────────────┐    ┌─────────────────┴──────┐          │
│  │   Bot           │    │   DynamoDB Local       │          │
│  │   Telegram      │    │   (8000)               │          │
│  │   Polling Mode  │    └────────────────────────┘          │
│  └─────────────────┘                                        │
│                         ┌────────────────────────┐          │
│                         │   MinIO (S3)           │          │
│                         │   (9000/9001)          │          │
│                         └────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| nginx | 80, 443 | Reverse proxy |
| web | 3000 | React Router SSR frontend |
| server | 3001 | Hono REST API |
| bot | - | Telegram bot (polling mode) |
| dynamodb | 8000 | DynamoDB Local |
| dynamodb-admin | 8001 | DynamoDB Admin UI |
| minio | 9000, 9001 | S3-compatible storage |

## Configuration

### AI Provider

For self-hosted deployment, use direct Anthropic API instead of AWS Bedrock:

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-3-5-haiku-20241022
```

Available models:
- `claude-3-5-haiku-20241022` (fast, cheap)
- `claude-3-5-sonnet-20241022` (balanced)
- `claude-3-opus-20240229` (most capable)

### SSL/HTTPS (Production)

1. Place certificates in `docker/nginx/ssl/`:
   - `fullchain.pem` (certificate + chain)
   - `privkey.pem` (private key)

2. Uncomment HTTPS server block in `docker/nginx/nginx.conf`

3. Update `APP_URL` in `.env` to use `https://`

### Telegram Bot Setup

1. Create bot with [@BotFather](https://t.me/BotFather)
2. Set bot commands:
   ```
   start - Start the bot
   newgroup - Create a new expense group
   help - Show help message
   ```
3. Enable Mini App in BotFather → Bot Settings → Menu Button

## Management Commands

```bash
# View app logs
docker-compose logs -f

# View infra logs
docker-compose -f docker-compose.infra.yml logs -f

# View specific service logs
docker-compose logs -f bot
docker-compose -f docker-compose.infra.yml logs -f dynamodb

# Restart a service
docker-compose restart server

# Stop apps only
docker-compose down

# Stop infrastructure
docker-compose -f docker-compose.infra.yml down

# Stop and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.infra.yml down -v

# Rebuild apps after code changes
docker-compose build --no-cache
docker-compose up -d
```

## Admin UIs

- **DynamoDB Admin**: http://localhost:8001
- **MinIO Console**: http://localhost:9001

## Troubleshooting

### Bot not responding
- Check bot logs: `docker-compose logs bot`
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Ensure bot is not running elsewhere (polling mode conflicts)

### API errors
- Check server logs: `docker-compose logs server`
- Verify DynamoDB is healthy: `docker-compose ps dynamodb`
- Check table exists: Visit http://localhost:8001

### AI not working
- Verify `ANTHROPIC_API_KEY` is valid
- Check server logs for API errors
- Ensure `AI_PROVIDER=anthropic` is set

### MinIO connection issues
- Check MinIO is healthy: `docker-compose ps minio`
- Verify bucket exists: Visit http://localhost:9001

## Updating

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d
```

## Backups

### DynamoDB data
```bash
# Export data (using dynamodb-admin)
docker-compose exec dynamodb-admin sh

# Or copy the volume
docker cp $(docker-compose ps -q dynamodb):/data ./backup/dynamodb
```

### MinIO data
```bash
# Copy the volume
docker cp $(docker-compose ps -q minio):/data ./backup/minio
```
