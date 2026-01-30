/**
 * Telegram utility functions
 */

export interface TelegramUserMention {
  userName: string;
  username?: string;
  telegramId?: number;
}

/**
 * Format user mention as Telegram link
 * - Uses @username if available
 * - Falls back to tg://user?id= deep link for users without username
 * - Falls back to plain name if no telegramId
 */
export function formatUserMention(user: TelegramUserMention): string {
  const name = user.userName.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] || c);
  if (user.username) {
    return `@${user.username}`;
  }

  if (user.telegramId) {
    return `<a href="tg://user?id=${user.telegramId}">${name}</a>`;
  }

  return name;
}

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
export function escapeHtml(text: string): string {
  return text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] || c);
}
