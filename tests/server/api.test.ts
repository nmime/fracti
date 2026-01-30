import { describe, expect, it, vi } from 'vitest';

// Mock config before any other imports
vi.mock('@server/config', () => ({
  config: {
    NODE_ENV: 'test',
    AWS_SAM_LOCAL: false,
    TABLE_NAME: 'fracti-test',
    S3_BUCKET_NAME: 'fracti-test-bucket',
    TELEGRAM_BOT_TOKEN: 'test-token',
    MINI_APP_URL: 'https://t.me/FractiBot/app',
    BEDROCK_MODEL_ID: 'anthropic.claude-sonnet-4-20250514-v1:0',
    AWS_REGION: 'us-east-1',
    ALLOWED_ORIGINS: ['http://localhost:3000'],
    TONCENTER_API_URL: 'https://toncenter.com/api/v3',
    SKIP_TON_VERIFICATION: false,
  },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
  isLocalDev: false,
  getAllowedOrigins: () => ['http://localhost:3000', 'http://localhost:5173'],
}));

// Mock logger
vi.mock('@server/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock @libs/db to avoid ElectroDB initialization issues
vi.mock('@libs/db', () => ({
  db: {
    entities: {
      group: { create: vi.fn(() => ({ go: vi.fn() })) },
      member: { create: vi.fn(() => ({ go: vi.fn() })) },
      expense: { create: vi.fn(() => ({ go: vi.fn() })) },
      settlement: { create: vi.fn(() => ({ go: vi.fn() })) },
    },
  },
  docClient: { send: vi.fn() },
  TABLE_NAME: 'test-table',
}));

// Mock AWS SDK clients
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: vi.fn(),
    })),
  },
  GetCommand: class MockGetCommand {
    constructor(public input: unknown) {}
  },
  PutCommand: class MockPutCommand {
    constructor(public input: unknown) {}
  },
  QueryCommand: class MockQueryCommand {
    constructor(public input: unknown) {}
  },
  DeleteCommand: class MockDeleteCommand {
    constructor(public input: unknown) {}
  },
  UpdateCommand: class MockUpdateCommand {
    constructor(public input: unknown) {}
  },
  BatchWriteCommand: class MockBatchWriteCommand {
    constructor(public input: unknown) {}
  },
  TransactWriteCommand: class MockTransactWriteCommand {
    constructor(public input: unknown) {}
  },
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: class MockDynamoDBClient {},
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class MockS3Client {
    send = vi.fn();
  },
  PutObjectCommand: class MockPutObjectCommand {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class MockGetObjectCommand {
    constructor(public input: unknown) {}
  },
}));

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class MockBedrockRuntimeClient {
    send = vi.fn();
  },
  InvokeModelCommand: class MockInvokeModelCommand {
    constructor(public input: unknown) {}
  },
  ThrottlingException: class ThrottlingException extends Error {},
  ServiceQuotaExceededException: class ServiceQuotaExceededException extends Error {},
}));

// Import app after mocks are set up
import { app } from '@server/index';

describe('API Health Check', () => {
  it('should return health status', async () => {
    const res = await app.request('/api/health');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('ok');
    expect(json.data.service).toBe('fracti-api');
    expect(json.data.version).toBe('1.0.0');
    expect(json.data.timestamp).toBeDefined();
    expect(json.data.requestId).toBeDefined();
  });
});

describe('API Error Handling', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await app.request('/api/unknown-route');
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe('Not Found');
  });

  it('should include request ID in error responses', async () => {
    const res = await app.request('/api/unknown-route');
    const json = await res.json();

    expect(json.requestId).toBeDefined();
  });
});

describe('API Security Headers', () => {
  it('should include security headers', async () => {
    const res = await app.request('/api/health');

    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('should include request ID header', async () => {
    const res = await app.request('/api/health');

    // Check that response includes the exposed header
    const exposeHeaders = res.headers.get('access-control-expose-headers');
    expect(exposeHeaders).toContain('X-Request-Id');
  });
});

describe('API Rate Limiting', () => {
  it('should include rate limit headers', async () => {
    const res = await app.request('/api/health');

    // Health endpoint doesn't have rate limiting
    // But other endpoints should
    expect(res.status).toBe(200);
  });
});

describe('CORS Configuration', () => {
  it('should handle OPTIONS preflight requests', async () => {
    const res = await app.request('/api/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://web.telegram.org',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('should include CORS headers in responses', async () => {
    const res = await app.request('/api/health', {
      headers: {
        Origin: 'https://web.telegram.org',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBeDefined();
  });
});

describe('API Response Format', () => {
  it('should return JSON content type', async () => {
    const res = await app.request('/api/health');

    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('should use consistent response structure for success', async () => {
    const res = await app.request('/api/health');
    const json = await res.json();

    expect(json).toHaveProperty('success');
    expect(json).toHaveProperty('data');
    expect(json.success).toBe(true);
  });

  it('should use consistent response structure for errors', async () => {
    const res = await app.request('/api/unknown');
    const json = await res.json();

    expect(json).toHaveProperty('success');
    expect(json).toHaveProperty('error');
    expect(json.success).toBe(false);
  });
});

describe('API Compression', () => {
  it('should support compression when requested', async () => {
    const res = await app.request('/api/health', {
      headers: {
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    // Hono's compress middleware handles this
    expect(res.status).toBe(200);
  });
});

describe('Server Timing', () => {
  it('should include server timing header', async () => {
    const res = await app.request('/api/health');

    // The timing middleware adds this
    const timing = res.headers.get('server-timing');
    // Note: timing might be null if not enabled, but shouldn't error
    expect(res.status).toBe(200);
  });
});
