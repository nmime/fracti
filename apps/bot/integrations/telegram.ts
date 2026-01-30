import {
  getFileUrl as getFileUrlBase,
  downloadFile as downloadFileBase,
  getUserProfilePhoto as getUserProfilePhotoBase,
  downloadUserProfilePhoto as downloadUserProfilePhotoBase,
} from '@libs/integrations';
import { getBotToken } from '../config';

/**
 * Telegram API integration utilities
 */

export async function getFileUrl(fileId: string): Promise<string | null> {
  return getFileUrlBase(fileId, getBotToken());
}

export async function downloadFile(fileId: string): Promise<Buffer | null> {
  return downloadFileBase(fileId, getBotToken());
}

export async function getUserProfilePhoto(userId: number): Promise<string | null> {
  return getUserProfilePhotoBase(userId, getBotToken());
}

export async function downloadUserProfilePhoto(userId: number): Promise<{ buffer: Buffer; mimeType: string } | null> {
  return downloadUserProfilePhotoBase(userId, getBotToken());
}
