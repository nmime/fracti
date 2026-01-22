import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useTelegram } from '@/lib/telegram'
import { logger } from '@/lib/logger'

/**
 * Handles deep link routing from Telegram bot commands
 *
 * Deep link format: action_groupId_optionalParams
 * Examples:
 * - view_abc123 -> Navigate to group view
 * - settle_abc123 -> Navigate to settle page for group
 * - expense_abc123_xyz789 -> Navigate to specific expense
 * - analytics_abc123 -> Navigate to analytics page for group
 * - recurring_abc123 -> Navigate to recurring templates for group
 */
export function DeepLinkHandler() {
  const navigate = useNavigate()
  const { deepLink, isReady } = useTelegram()
  const hasHandled = useRef(false)

  useEffect(() => {
    // Only handle once when ready and we have a deep link
    if (!isReady || hasHandled.current) return
    if (!deepLink.groupId && !deepLink.action) return

    hasHandled.current = true

    const { action, groupId } = deepLink

    logger.info('Handling deep link', { action, groupId })

    // Store groupId for the app to use
    if (groupId) {
      sessionStorage.setItem('fracti_groupId', groupId)
    }

    // Navigate based on action
    switch (action) {
      case 'settle':
        navigate('/settle')
        break
      case 'expense':
        navigate('/expenses')
        break
      case 'analytics':
        navigate('/analytics')
        break
      case 'recurring':
        navigate('/recurring')
        break
      case 'view':
      default:
        navigate('/')
        break
    }
  }, [isReady, deepLink, navigate])

  // This component doesn't render anything
  return null
}

/**
 * Hook to get the current group ID from deep link or session storage
 */
export function useGroupId(): string | null {
  const { deepLink } = useTelegram()

  // First check deep link, then session storage
  if (deepLink.groupId) {
    return deepLink.groupId
  }

  // Check session storage for persisted group ID
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('fracti_groupId')
  }

  return null
}
