import {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb'
import { docClient, TABLE_NAME } from '../integrations/dynamodb'
import type { PaginationOptions, PaginatedResult } from '../types/db.types'

export { docClient, TABLE_NAME }

export {
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
  TransactWriteCommand,
}

/**
 * Base repository with common DynamoDB operations
 */
export abstract class BaseRepository {
  protected readonly tableName = TABLE_NAME
  protected readonly client = docClient

  /**
   * Execute a get operation
   */
  protected async get<T>(key: { PK: string; SK: string }): Promise<T | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: key,
      })
    )
    return (result.Item as T) ?? null
  }

  /**
   * Execute a put operation
   */
  protected async put<T extends object>(item: T): Promise<T> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      })
    )
    return item
  }

  /**
   * Execute a query operation with pagination
   */
  protected async query<T>(
    keyCondition: string,
    expressionValues: Record<string, unknown>,
    options?: PaginationOptions & {
      indexName?: string
      scanForward?: boolean
      filterExpression?: string
    }
  ): Promise<PaginatedResult<T>> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: options?.indexName,
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: expressionValues,
        FilterExpression: options?.filterExpression,
        ScanIndexForward: options?.scanForward ?? true,
        Limit: options?.limit,
        ExclusiveStartKey: options?.lastKey,
      })
    )

    return {
      items: (result.Items as T[]) ?? [],
      lastKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
      hasMore: !!result.LastEvaluatedKey,
    }
  }

  /**
   * Execute a query and fetch all items (no pagination limit)
   */
  protected async queryAll<T>(
    keyCondition: string,
    expressionValues: Record<string, unknown>,
    options?: {
      indexName?: string
      scanForward?: boolean
      filterExpression?: string
    }
  ): Promise<T[]> {
    const allItems: T[] = []
    let lastKey: Record<string, unknown> | undefined

    do {
      const result = await this.query<T>(keyCondition, expressionValues, {
        ...options,
        lastKey,
      })
      allItems.push(...result.items)
      lastKey = result.lastKey
    } while (lastKey)

    return allItems
  }

  /**
   * Execute a delete operation
   */
  protected async delete(key: { PK: string; SK: string }): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: key,
      })
    )
  }

  /**
   * Execute an update operation
   */
  protected async update(
    key: { PK: string; SK: string },
    updateExpression: string,
    expressionValues: Record<string, unknown>,
    expressionNames?: Record<string, string>
  ): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: expressionNames,
      })
    )
  }

  /**
   * Execute a transact write operation
   */
  protected async transactWrite(
    items: Array<{
      Put?: { Item: object }
      Delete?: { Key: { PK: string; SK: string } }
      Update?: {
        Key: { PK: string; SK: string }
        UpdateExpression: string
        ExpressionAttributeValues: Record<string, unknown>
      }
    }>
  ): Promise<void> {
    const transactItems = items.map((item) => {
      if (item.Put) {
        return { Put: { TableName: this.tableName, Item: item.Put.Item } }
      }
      if (item.Delete) {
        return { Delete: { TableName: this.tableName, Key: item.Delete.Key } }
      }
      if (item.Update) {
        return {
          Update: {
            TableName: this.tableName,
            Key: item.Update.Key,
            UpdateExpression: item.Update.UpdateExpression,
            ExpressionAttributeValues: item.Update.ExpressionAttributeValues,
          },
        }
      }
      throw new Error('Invalid transaction item')
    })

    await this.client.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      })
    )
  }

  /**
   * Execute a batch write operation
   */
  protected async batchWrite(
    items: Array<{ PutRequest?: { Item: object }; DeleteRequest?: { Key: object } }>
  ): Promise<void> {
    const chunks: typeof items[] = []
    for (let i = 0; i < items.length; i += 25) {
      chunks.push(items.slice(i, i + 25))
    }

    for (const chunk of chunks) {
      await this.client.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk,
          },
        })
      )
    }
  }
}
