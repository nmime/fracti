import { getGroup, getGroupsByUser } from '@libs/db';
import { DefaultCurrency } from '@libs/types';
import { getMiniAppUrl } from '../config';
import type { Bot } from 'grammy';

/**
 * Inline query handlers for the Telegram bot
 */

// Helper to create inline keyboard button for Mini App
// Inline queries use URL buttons with t.me deeplink (MINI_APP_URL)
function createMiniAppButton(text: string, url: string) {
  return { text, url };
}

export function registerInlineHandlers(bot: Bot): void {
  bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim();
    const userId = ctx.from.id;
    const match = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(query);
    const results = [];

    if (match) {
      const amount = parseFloat(match[1]);
      const description = match[2] || 'Expense';
      const memberships = await getGroupsByUser(userId);

      if (memberships.length > 0) {
        for (const membership of memberships.slice(0, 10)) {
          const groupId = membership.GSI1SK?.replace('GROUP#', '') || '';
          const group = await getGroup(groupId);
          if (!group) continue;

          results.push({
            type: 'article' as const,
            id: `expense-${groupId}-${Date.now()}`,
            title: `💸 ${amount} - ${description}`,
            description: `Add to ${group.title}`,
            input_message_content: {
              message_text:
                `💸 <b>New Expense</b>\n\n` +
                `Amount: <b>${amount} ${group.currency ?? DefaultCurrency}</b>\n` +
                `Description: ${description}\n` +
                `Group: ${group.title}\n\n` +
                `<i>Open the app to confirm and split this expense</i>`,
              parse_mode: 'HTML' as const,
            },
            reply_markup: {
              inline_keyboard: [
                [
                  createMiniAppButton(
                    '✅ Add Expense',
                    `${getMiniAppUrl()}?group=${groupId}&amount=${amount}&desc=${encodeURIComponent(description)}`,
                  ),
                ],
              ],
            },
          });
        }
      }

      results.push({
        type: 'article' as const,
        id: `expense-new-${Date.now()}`,
        title: `💸 ${amount} - ${description}`,
        description: 'Share expense details',
        input_message_content: {
          message_text:
            `💸 <b>Expense to Split</b>\n\n` +
            `Amount: <b>${amount}</b>\n` +
            `Description: ${description}\n\n` +
            `<i>Add me to a group to track shared expenses!</i>`,
          parse_mode: 'HTML' as const,
        },
      });
    } else if (query.length === 0) {
      results.push({
        type: 'article' as const,
        id: 'help',
        title: '💡 How to use inline mode',
        description: 'Type: amount description (e.g., "50 dinner")',
        input_message_content: {
          message_text:
            `💡 <b>Fracti Inline Mode</b>\n\n` +
            `Type: <code>@${ctx.me.username} 50 dinner</code>\n\n` +
            `This lets you quickly share expenses in any chat!`,
          parse_mode: 'HTML' as const,
        },
      });
    }

    await ctx.answerInlineQuery(results, {
      cache_time: 10,
      is_personal: true,
    });
  });
}
