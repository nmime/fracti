import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api, type GroupWithMembers, type UserGroup } from '../services/api';
import { logger } from '../utils/logger';
import { useAuth } from './AuthProvider';
import { useTelegram } from './TelegramProvider';

/**
 * Group context provider for managing selected group state
 * Waits for authentication before fetching groups
 */

interface GroupContextValue {
  groupId: string | null;
  group: GroupWithMembers | null;
  userGroups: UserGroup[];
  isLoading: boolean;
  error: string | null;
  setGroupId: (id: string) => Promise<void>;
  clearGroupSelection: () => void;
  refreshGroups: () => Promise<UserGroup[]>;
}

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const { deepLink } = useTelegram();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [groupId, setGroupIdState] = useState<string | null>(deepLink.groupId || null);
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshGroups = useCallback(async (): Promise<UserGroup[]> => {
    if (!isAuthenticated) {
      return [];
    }

    try {
      const groups = await api.getUserGroups();
      setUserGroups(groups);

      return groups;
    } catch (err) {
      logger.error('Failed to fetch user groups', {}, err);

      return [];
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Wait for auth to finish loading before making API calls
    if (authLoading) {
      return;
    }

    // If not authenticated, don't fetch groups
    if (!isAuthenticated) {
      setIsLoading(false);
      setUserGroups([]);

      return;
    }

    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await refreshGroups();
        const activeGroupId = deepLink.groupId;

        if (activeGroupId) {
          setGroupIdState(activeGroupId);
          try {
            const groupData = await api.getGroup(activeGroupId);
            setGroup(groupData);
          } catch (err) {
            logger.warn('Failed to fetch group details', { groupId: activeGroupId }, err);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
        logger.error('Failed to load initial data', {}, err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadInitialData();
  }, [deepLink.groupId, refreshGroups, authLoading, isAuthenticated]);

  const setGroupId = useCallback(async (id: string) => {
    setGroupIdState(id);
    try {
      const groupData = await api.getGroup(id);
      setGroup(groupData);
    } catch (err) {
      logger.error('Failed to fetch group', { groupId: id }, err);
    }
  }, []);

  const clearGroupSelection = useCallback(() => {
    setGroupIdState(null);
    setGroup(null);
  }, []);

  const value = useMemo<GroupContextValue>(
    () => ({
      groupId,
      group,
      userGroups,
      isLoading,
      error,
      setGroupId,
      clearGroupSelection,
      refreshGroups,
    }),
    [groupId, group, userGroups, isLoading, error, setGroupId, clearGroupSelection, refreshGroups],
  );

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (!context) {
    throw new Error('useGroup must be used within a GroupProvider');
  }

  return context;
}

export function useRequiredGroupId(): string {
  const { groupId, isLoading } = useGroup();

  if (isLoading) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Promise(() => {});
  }

  if (!groupId) {
    throw new Error('No group selected');
  }

  return groupId;
}
