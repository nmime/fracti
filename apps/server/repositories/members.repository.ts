import { BaseRepository } from './base.repository'
import { keys, GSI_PREFIXES } from '../integrations/dynamodb'
import type { MemberRecord, CreateMemberInput, PaginationOptions, PaginatedResult } from '../types/db.types'

class MembersRepository extends BaseRepository {
  async findByGroupAndUser(groupId: string, telegramId: number): Promise<MemberRecord | null> {
    return this.get<MemberRecord>(keys.user(groupId, telegramId))
  }

  async findByGroup(groupId: string): Promise<MemberRecord[]> {
    return this.queryAll<MemberRecord>(
      'PK = :pk AND begins_with(SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.GROUP}${groupId}`,
        ':sk': GSI_PREFIXES.USER,
      }
    )
  }

  async findGroupsByUser(
    telegramId: number,
    options?: PaginationOptions
  ): Promise<PaginatedResult<MemberRecord>> {
    return this.query<MemberRecord>(
      'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      {
        ':pk': `${GSI_PREFIXES.USER}${telegramId}`,
        ':sk': GSI_PREFIXES.GROUP,
      },
      { ...options, indexName: 'GSI1' }
    )
  }

  async upsert(groupId: string, input: CreateMemberInput): Promise<MemberRecord> {
    const item: MemberRecord = {
      ...keys.user(groupId, input.telegramId),
      ...input,
      GSI1PK: `${GSI_PREFIXES.USER}${input.telegramId}`,
      GSI1SK: `${GSI_PREFIXES.GROUP}${groupId}`,
      joinedAt: input.joinedAt ?? new Date().toISOString(),
    }
    return this.put(item)
  }

  async updateWallet(groupId: string, telegramId: number, wallet: string): Promise<void> {
    await this.update(
      keys.user(groupId, telegramId),
      'SET wallet = :wallet',
      { ':wallet': wallet }
    )
  }
}

export const membersRepository = new MembersRepository()
