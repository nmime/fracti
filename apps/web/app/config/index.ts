/**
 * Frontend configuration using Vite environment variables
 */

export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_URL || '/api',
} as const;

// Get absolute manifest URL (TON Connect requires absolute URLs)
function getManifestUrl(): string {
  const configuredUrl = import.meta.env.VITE_TONCONNECT_MANIFEST_URL || '/tonconnect-manifest.json';

  // If already absolute, return as-is
  if (configuredUrl.startsWith('http://') || configuredUrl.startsWith('https://')) {
    return configuredUrl;
  }

  // In browser, compute absolute URL from origin
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${configuredUrl.startsWith('/') ? '' : '/'}${configuredUrl}`;
  }

  // SSR fallback
  return `https://d13kjkw1fvmjar.cloudfront.net${configuredUrl.startsWith('/') ? '' : '/'}${configuredUrl}`;
}

export const tonConfig = {
  get manifestUrl() {
    return getManifestUrl();
  },
} as const;

export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
