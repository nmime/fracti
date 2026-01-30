/**
 * Standalone server entry point for self-hosted deployment
 *
 * This file runs the Hono server using Node.js HTTP server
 * instead of AWS Lambda handler.
 *
 * Usage:
 *   NODE_ENV=production node dist/serve.js
 *   or
 *   tsx serve.ts (development)
 */

import { serve } from '@hono/node-server';
import { app } from './index';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

console.log(`Starting Fracti API server...`);
console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
console.log(`AI Provider: ${process.env.AI_PROVIDER ?? 'bedrock'}`);

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  },
  (info) => {
    console.log(`Server running at http://${info.address}:${info.port}`);
    console.log(`Health check: http://${info.address}:${info.port}/api/health`);
  },
);
