import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { useTelegram } from './telegram'
import { api, type Group, type UserGroup } from './api'
import { logger } from './logger'

interface GroupContextValue {
  groupId: string | null
  group: Group | null
  userGroups: UserGroup[]
  isLoading: boolean
  error: string | null
  setGroupId: (id: string) => void
  refreshGroups: () => Promise<UserGroup[]>
}

const GroupContext = createContext<GroupContextValue | null>(null)

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { deepLink, initData } = useTelegram()
  const [groupId, setGroupIdState] = useState<string | null>(deepLink.groupId || null)
  const [group, setGroup] = useState<Group | null>(null)
  const [userGroups, setUserGroups] = useState<UserGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Set init data for API client
  useEffect(() => {
    if (initData) {
      api.setInitData(initData)
    }
  }, [initData])

  // Fetch user's groups
  const refreshGroups = useCallback(async (): Promise<UserGroup[]> => {
    try {
      const groups = await api.getUserGroups()
      setUserGroups(groups)
      return groups
    } catch (err) {
      logger.error('Failed to fetch user groups', {}, err)
      return []
    }
  }, [])

  // Initial load - get groups and determine active group
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch user's groups
        const groups = await refreshGroups()

        // Determine which group to use
        let activeGroupId = deepLink.groupId

        // If no groupId from deep link, use first group
        if (!activeGroupId && groups.length > 0) {
          activeGroupId = groups[0].id
        }

        if (activeGroupId) {
          setGroupIdState(activeGroupId)
          // Fetch the group details
          try {
            const groupData = await api.getGroup(activeGroupId)
            setGroup(groupData)
          } catch (err) {
            logger.warn('Failed to fetch group details', { groupId: activeGroupId }, err)
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data'
        setError(message)
        logger.error('Failed to load initial data', {}, err)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialData()
  }, [deepLink.groupId, refreshGroups])

  // Update group when groupId changes
  const setGroupId = useCallback(async (id: string) => {
    setGroupIdState(id)
    try {
      const groupData = await api.getGroup(id)
      setGroup(groupData)
    } catch (err) {
      logger.error('Failed to fetch group', { groupId: id }, err)
    }
  }, [])

  const value = useMemo<GroupContextValue>(() => ({
    groupId,
    group,
    userGroups,
    isLoading,
    error,
    setGroupId,
    refreshGroups,
  }), [groupId, group, userGroups, isLoading, error, setGroupId, refreshGroups])

  return (
    <GroupContext.Provider value={value}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const context = useContext(GroupContext)
  if (!context) {
    throw new Error('useGroup must be used within a GroupProvider')
  }
  return context
}

/**
 * Hook that returns groupId, throwing if no group is selected.
 * Use this in pages that require a group to be selected.
 */
export function useRequiredGroupId(): string {
  const { groupId, isLoading } = useGroup()

  if (isLoading) {
    throw new Promise(() => {}) // Suspend during loading
  }

  if (!groupId) {
    throw new Error('No group selected')
  }

  return groupId
}
