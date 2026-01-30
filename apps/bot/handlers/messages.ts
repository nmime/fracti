import { getGroup, createGroup, getGroupMembers, getUser } from '@libs/db';
import { extractJSON } from '@libs/tools';
import { InlineKeyboard } from 'grammy';
import { getMiniAppUrl } from '../config';
import { getTranslatorAsync } from '../i18n';
import { invokeClaudeText, invokeClaudeVision } from '../integrations/bedrock';
import { downloadFile } from '../integrations/telegram';
import { PARSER_SYSTEM_PROMPT, VISION_SYSTEM_PROMPT } from '../services/ai.service';
import { createExpenseFromParsed, findPayerFromMembers } from '../services/expense.service';
import { getChatTitle, registerUserWithAvatar } from '../services/user.service';
import { formatUserMention } from '../utils';
import type { Bot, Context, NextFunction } from 'grammy';

/**
 * Message handlers for the Telegram bot
 */

/**
 * Middleware to register group and user for ANY message in a group chat
 * This runs before all other handlers
 */
async function groupRegistrationMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  // Only process group messages
  if (ctx.chat?.type === 'private') {
    return next();
  }

  const chatId = ctx.chat?.id;
  const user = ctx.from;

  if (chatId && user) {
    const groupId = String(chatId);

    // Register group if needed
    let group = await getGroup(groupId);
    if (!group) {
      group = await createGroup({
        id: groupId,
        chatId: groupId,
        title: getChatTitle(ctx.chat),
        createdAt: new Date().toISOString(),
        memberCount: 1,
      });
    }

    // Register user in this group
    await registerUserWithAvatar(groupId, user);
  }

  return next();
}

// Helper to create a Mini App button
// Message handlers only run in groups, so always use URL button with MINI_APP_URL (t.me deeplink)
function addMiniAppButton(keyboard: InlineKeyboard, text: string): InlineKeyboard {
  return keyboard.url(text, getMiniAppUrl());
}

async function handleExpenseMessage(ctx: Context): Promise<void> {
  const t = await getTranslatorAsync(ctx);
  const chatId = ctx.chat?.id;
  const user = ctx.from;
  const text = ctx.message?.text;

  if (!chatId || !user || !text) return;

  const groupId = String(chatId);
  const group = await getGroup(groupId);
  if (!group) return;

  try {
    const response = await invokeClaudeText(PARSER_SYSTEM_PROMPT, text);

    const parsed = extractJSON<{
      payer?: string;
      amount?: number;
      description?: string;
      beneficiaries?: string[];
      category?: string;
      confidence?: number;
    }>(response);

    if (!parsed?.amount || parsed.amount <= 0 || (parsed.confidence ?? 0) < 0.5) return;

    const members = await getGroupMembers(groupId);

    // Get current user's member record for proper UUID
    const currentMember = await getUser(groupId, user.id);
    if (!currentMember) {
      console.error('Current user not found in group', { groupId, telegramId: user.id });
      return;
    }

    const { payerId, payerName, payerUsername, payerTelegramId } = findPayerFromMembers(
      parsed.payer,
      members,
      currentMember.id,
      currentMember.name,
      currentMember.username,
      currentMember.telegramId,
    );

    const { splits } = await createExpenseFromParsed({
      groupId,
      group,
      payerId,
      payerName,
      amount: parsed.amount,
      description: parsed.description || 'Expense',
      beneficiaries: parsed.beneficiaries,
      category: parsed.category,
    });

    const eachAmount = (parsed.amount / splits.length).toFixed(2);
    let splitText: string;
    if (splits.length > 1) {
      const memberList = splits.map(formatUserMention).join(', ');
      splitText = `${t('bot.expense.splitWays', { count: splits.length, each: eachAmount })}\n${t('bot.expense.splitWith', { members: memberList })}`;
    } else {
      splitText = t('bot.expense.soloExpense');
    }

    const keyboard = new InlineKeyboard();
    addMiniAppButton(keyboard, t('bot.welcome.openApp'));
    const description = parsed.description || 'Expense';

    const payerMention = formatUserMention({ userName: payerName, username: payerUsername, telegramId: payerTelegramId });
    await ctx.reply(
      `✅ ${t('bot.expense.created', { description, amount: parsed.amount })}\n` +
        `${t('bot.expense.paidBy', { name: payerMention })}\n${splitText}`,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard,
        reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
      },
    );
  } catch (error) {
    console.error('Expense parsing failed:', error);
  }
}

async function handlePhotoMessage(ctx: Context): Promise<void> {
  const t = await getTranslatorAsync(ctx);
  const chatId = ctx.chat?.id;
  const user = ctx.from;
  const photos = ctx.message?.photo;

  if (!chatId || !user || !photos?.length) return;

  const photo = photos[photos.length - 1];

  try {
    const imageBuffer = await downloadFile(photo.file_id);
    if (!imageBuffer) {
      await ctx.reply(`❌ ${t('bot.receipt.downloadError')}`, {
        reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
      });

      return;
    }

    await ctx.reply(`🔍 ${t('bot.receipt.scanning')}`, {
      reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
    });

    const response = await invokeClaudeVision(VISION_SYSTEM_PROMPT, imageBuffer.toString('base64'), 'image/jpeg');

    const parsed = extractJSON<{
      merchant?: string;
      items?: { name: string; price: number }[];
      total?: number;
      currency?: string;
    }>(response);

    if (!parsed) {
      await ctx.reply(`❌ ${t('bot.receipt.parseError')}`);

      return;
    }

    if (!parsed.items?.length) {
      await ctx.reply(`❌ ${t('bot.receipt.noItems')}`);

      return;
    }

    const receiptTotal = parsed.total ?? parsed.items.reduce((sum, item) => sum + item.price, 0);

    let summary = `🧾 ${t('bot.receipt.success', { merchant: parsed.merchant || 'Receipt' })}\n\n`;
    for (const item of parsed.items.slice(0, 8)) {
      summary += `• ${item.name}: ${item.price} ${parsed.currency ?? ''}\n`;
    }

    if (parsed.items.length > 8) {
      summary += `<i>...+${parsed.items.length - 8}</i>\n`;
    }

    summary += `\n<b>${t('bot.receipt.total', { amount: receiptTotal, currency: parsed.currency ?? '' })}</b>`;

    const keyboard = new InlineKeyboard();
    addMiniAppButton(keyboard, t('bot.welcome.openApp'));

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch {
    await ctx.reply(`❌ ${t('bot.receipt.scanError')}`, {
      reply_parameters: { message_id: ctx.message?.message_id ?? 0 },
    });
  }
}

export function registerMessageHandlers(bot: Bot): void {
  // Middleware: Register group and user for ALL messages in groups
  // This runs for text, photos, stickers, commands - everything
  bot.use(groupRegistrationMiddleware);

  // Handle text messages (expense parsing when bot is mentioned)
  bot.on('message:text', async (ctx) => {
    if (ctx.chat.type === 'private') return;

    // Skip commands (they're handled by command handlers)
    if (ctx.message.text.startsWith('/')) return;

    // Check if bot is mentioned via text or message entities
    const botUsername = ctx.me.username.toLowerCase();
    const text = ctx.message.text.toLowerCase();
    const entities = ctx.message.entities || [];

    // Check plain text mention (@username)
    const hasTextMention = text.includes(`@${botUsername}`);

    // Check entity mentions (text_mention for users, mention for @username)
    const hasEntityMention = entities.some((entity) => {
      if (entity.type === 'mention') {
        // Extract the mentioned username from text
        const mentionText = ctx.message.text.slice(entity.offset, entity.offset + entity.length).toLowerCase();

        return mentionText === `@${botUsername}`;
      }

      if (entity.type === 'text_mention' && entity.user) {
        // Direct mention by user ID
        return entity.user.id === ctx.me.id;
      }

      return false;
    });

    if (!hasTextMention && !hasEntityMention) return;

    await handleExpenseMessage(ctx);
  });

  // Handle photo messages (receipt scanning)
  bot.on('message:photo', async (ctx) => {
    if (ctx.chat.type === 'private') return;
    // Group/user registration already handled by middleware
    await handlePhotoMessage(ctx);
  });
}
