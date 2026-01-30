import $ from '@libs/constants';
import { initS3, uploadToS3, uploadAvatar, getS3Url, getPresignedUrl, transformAvatarUrl } from '@libs/integrations';
import { getAwsRegion, getS3BucketName } from '../config';

// Initialize S3 with bot config
initS3({
  region: getAwsRegion(),
  bucketName: getS3BucketName(),
});

// Re-export with custom uploadAvatar that uses constants
export { uploadToS3, getS3Url, getPresignedUrl, transformAvatarUrl };

export async function uploadAvatarWithPath(
  telegramId: number,
  imageBuffer: Buffer,
  mimeType = 'image/jpeg',
): Promise<string> {
  return uploadAvatar(telegramId, imageBuffer, mimeType, $.artifacts.s3.avatars);
}

export { uploadAvatarWithPath as uploadAvatar };
