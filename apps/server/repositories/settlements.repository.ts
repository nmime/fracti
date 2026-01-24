import { BaseRepository } from './base.repository'
import { keys, GSI_PREFIXES } from '../integrations/dynamodb'
import type {
  SettlementRecord,
  CreateSettlementInput,
  PaginationOptions,
  PaginatedResult,
} from '../types/db.types'

class SettlementsRepository extends BaseRepository {
  async findByGroup(
    groupId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<SettlementRecord>> {
    return this.query<SettlementRecord>(
      'PK = :pk AND begins_with(SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.GROUP}${groupId}`,
        ':sk': GSI_PREFIXES.SETTLE,
      },
      { ...options, scanForward: false }
    )
  }

  async findAllByGroup(groupId: string): Promise<SettlementRecord[]> {
    return this.queryAll<SettlementRecord>(
      'PK = :pk AND begins_with(SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.GROUP}${groupId}`,
        ':sk': GSI_PREFIXES.SETTLE,
      },
      { scanForward: false }
    )
  }

  async findById(settlementId: string): Promise<SettlementRecord | null> {
    const result = await this.query<SettlementRecord>(
      'GSI2PK = :pk',
      { ':pk': `${GSI_PREFIXES.SETTLEMENT}${settlementId}` },
      { indexName: 'GSI2' }
    )
    return result.items[0] ?? null
  }

  async findByCreatedAt(groupId: string, createdAt: string): Promise<SettlementRecord | null> {
    return this.get<SettlementRecord>(keys.settlement(groupId, createdAt))
  }

  async create(input: CreateSettlementInput): Promise<SettlementRecord> {
    const item: SettlementRecord = {
      ...keys.settlement(input.groupId, input.createdAt),
      ...input,
      GSI2PK: `${GSI_PREFIXES.SETTLEMENT}${input.id}`,
      GSI2SK: input.groupId,
      GSI3PK: `${GSI_PREFIXES.USER}${input.fromUserId}`,
      GSI3SK: `${GSI_PREFIXES.SETTLE}${input.createdAt}`,
    }
    return this.put(item)
  }

  async updateStatus(
    groupId: string,
    createdAt: string,
    status: SettlementRecord['status'],
    txHash?: string
  ): Promise<void> {
    const updateParts = ['#status = :status']
    const values: Record<string, unknown> = { ':status': status }
    const names: Record<string, string> = { '#status': 'status' }

    if (txHash) {
      updateParts.push('txHash = :txHash')
      values[':txHash'] = txHash
    }

    if (status === 'completed') {
      updateParts.push('completedAt = :completedAt')
      values[':completedAt'] = new Date().toISOString()
    }

    await this.update(
      keys.settlement(groupId, createdAt),
      `SET ${updateParts.join(', ')}`,
      values,
      names
    )
  }

  // User-centric queries
  async findByUser(
    telegramId: number,
    options?: PaginationOptions
  ): Promise<PaginatedResult<SettlementRecord>> {
    return this.query<SettlementRecord>(
      'GSI3PK = :pk AND begins_with(GSI3SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.USER}${telegramId}`,
        ':sk': GSI_PREFIXES.SETTLE,
      },
      { ...options, indexName: 'GSI3', scanForward: false }
    )
  }

  async findAllByUser(telegramId: number): Promise<SettlementRecord[]> {
    return this.queryAll<SettlementRecord>(
      'GSI3PK = :pk AND begins_with(GSI3SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.USER}${telegramId}`,
        ':sk': GSI_PREFIXES.SETTLE,
      },
      { indexName: 'GSI3', scanForward: false }
    )
  }
}

export const settlementsRepository = new SettlementsRepository()
