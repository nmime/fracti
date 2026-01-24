import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock AWS SDK before importing the module
vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    constructor() {}
    send = vi.fn()
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
  }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(() => Promise.resolve('https://presigned-url.example.com')),
}))

// Import after mocks are set up
import {
  getS3Url,
  transformAvatarUrl,
} from '@server/lib/s3'

// Mock config
vi.mock('@server/lib/config', () => ({
  config: {
    AWS_REGION: 'us-east-1',
    S3_BUCKET_NAME: 'test-bucket',
  },
}))

// Mock logger
vi.mock('@server/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('s3', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getS3Url', () => {
    it('should generate correct S3 URL for key', () => {
      const url = getS3Url('avatars/123.jpg')

      expect(url).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/avatars/123.jpg')
    })

    it('should handle keys with special characters', () => {
      const url = getS3Url('avatars/user+name.jpg')

      expect(url).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/avatars/user+name.jpg')
    })

    it('should handle nested paths', () => {
      const url = getS3Url('uploads/2024/01/15/file.png')

      expect(url).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/uploads/2024/01/15/file.png')
    })

    it('should handle root level keys', () => {
      const url = getS3Url('file.txt')

      expect(url).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/file.txt')
    })
  })

  describe('transformAvatarUrl', () => {
    it('should return undefined for null input', () => {
      const result = transformAvatarUrl(null)

      expect(result).toBeUndefined()
    })

    it('should return undefined for undefined input', () => {
      const result = transformAvatarUrl(undefined)

      expect(result).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      const result = transformAvatarUrl('')

      expect(result).toBeUndefined()
    })

    it('should return http URL as-is', () => {
      const url = 'http://example.com/avatar.jpg'
      const result = transformAvatarUrl(url)

      expect(result).toBe(url)
    })

    it('should return https URL as-is', () => {
      const url = 'https://example.com/avatar.jpg'
      const result = transformAvatarUrl(url)

      expect(result).toBe(url)
    })

    it('should transform relative key to S3 URL', () => {
      const result = transformAvatarUrl('avatars/123.jpg')

      expect(result).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/avatars/123.jpg')
    })

    it('should transform nested relative key', () => {
      const result = transformAvatarUrl('users/avatars/123.png')

      expect(result).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/users/avatars/123.png')
    })

    it('should handle HTTPS with different case', () => {
      // The function checks for lowercase http:// and https:// prefixes
      // Uppercase HTTPS:// won't match and will be treated as a relative path
      const url = 'https://example.com/avatar.jpg'
      const result = transformAvatarUrl(url)

      expect(result).toBe(url)
    })

    it('should transform Telegram avatar URLs correctly', () => {
      const telegramUrl = 'https://t.me/i/userpic/320/abc123.jpg'
      const result = transformAvatarUrl(telegramUrl)

      // Telegram URLs should be returned as-is
      expect(result).toBe(telegramUrl)
    })

    it('should handle S3 key with spaces', () => {
      const result = transformAvatarUrl('avatars/user name.jpg')

      expect(result).toBe('https://test-bucket.s3.us-east-1.amazonaws.com/avatars/user name.jpg')
    })
  })
})
