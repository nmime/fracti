import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import $ from '@libs/constants';

/**
 * DynamoDB client with configurable endpoint
 *
 * Supports:
 * - AWS DynamoDB (default, no endpoint)
 * - ScyllaDB Alternator (set DB_ENDPOINT env var)
 * - LocalStack (set DB_ENDPOINT=http://localhost:4566)
 * - Local DynamoDB (set DB_ENDPOINT=http://localhost:8000)
 */
const dbEndpoint = process.env.DB_ENDPOINT;

export const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? $.aws.region,
  ...(dbEndpoint && { endpoint: dbEndpoint }),
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export const TABLE_NAME = process.env[$.env.TABLE_NAME] ?? $.dynamodb.tableName;
