/**
 * Legacy re-exports for backward compatibility
 * New code should import directly from config/, services/, integrations/
 */
export * from '../config'
export { getChatTitle, isGroupChat, registerUserWithAvatar } from '../services/user.service'
