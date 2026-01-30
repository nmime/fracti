import { initS3, uploadToS3, uploadAvatar, getS3Url, getPresignedUrl, transformAvatarUrl } from '@libs/integrations';
import { config } from '../config';
import { logger } from '../utils/logger';

// Initialize S3 with server config
initS3(
  {
    region: config.AWS_REGION,
    bucketName: config.S3_BUCKET_NAME,
  },
  logger,
);

// Re-export everything
export { uploadToS3, uploadAvatar, getS3Url, getPresignedUrl, transformAvatarUrl };
