import { BaseRepository } from './base.repository'
import { keys } from '../integrations/dynamodb'
import type { GroupRecord, CreateGroupInput } from '../types/db.types'

class GroupsRepository extends BaseRepository {
  async findById(groupId: string): Promise<GroupRecord | null> {
    return this.get<GroupRecord>(keys.group(groupId))
  }

  async create(input: CreateGroupInput): Promise<GroupRecord> {
    const item: GroupRecord = {
      ...keys.group(input.id),
      ...input,
    }
    return this.put(item)
  }

  async updateMemberCount(groupId: string, count: number): Promise<void> {
    await this.update(
      keys.group(groupId),
      'SET memberCount = :count',
      { ':count': count }
    )
  }
}

export const groupsRepository = new GroupsRepository()
