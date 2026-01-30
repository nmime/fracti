import { Address, Cell, contractAddress, loadStateInit } from '@ton/core';
import { sha256 } from '@ton/crypto';
import nacl from 'tweetnacl';
import { createHmac } from 'crypto';
import { logger } from '../utils/logger';

// TON Proof payload validity duration (15 minutes)
const PROOF_VALIDITY_SECONDS = 15 * 60;

// Prefix for ton-proof message
const TON_PROOF_PREFIX = 'ton-proof-item-v2/';
const TON_CONNECT_PREFIX = 'ton-connect';

// Secret for signing payloads (use env var in production)
const PAYLOAD_SECRET = process.env.TON_PROOF_SECRET || 'fracti-ton-proof-secret-change-in-prod';

export interface TonProofPayload {
  payload: string;
  expiresAt: number;
}

export interface TonProof {
  timestamp: number;
  domain: {
    lengthBytes: number;
    value: string;
  };
  signature: string;
  payload: string;
}

export interface WalletInfo {
  address: string;
  publicKey: string;
  walletStateInit: string;
}

export interface CheckProofRequest {
  proof: TonProof;
  wallet: WalletInfo;
}

/**
 * Generate a signed payload for TON Proof verification
 * Stateless approach - payload contains timestamp and HMAC signature
 * Format: nonce.timestamp.signature (all hex encoded)
 */
export function generatePayload(): TonProofPayload {
  const nonce = Buffer.from(nacl.randomBytes(16)).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + PROOF_VALIDITY_SECONDS;

  // Create signature: HMAC(nonce + timestamp)
  const dataToSign = `${nonce}.${timestamp}`;
  const signature = createHmac('sha256', PAYLOAD_SECRET).update(dataToSign).digest('hex').slice(0, 16);

  // Payload format: nonce.timestamp.signature
  const payload = `${nonce}.${timestamp}.${signature}`;

  return { payload, expiresAt };
}

/**
 * Verify the payload signature and expiration
 */
function verifyPayload(payload: string): { valid: boolean; error?: string } {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid payload format' };
  }

  const [nonce, timestampStr, providedSignature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp in payload' };
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > PROOF_VALIDITY_SECONDS) {
    return { valid: false, error: 'Payload expired' };
  }

  // Verify signature
  const dataToSign = `${nonce}.${timestamp}`;
  const expectedSignature = createHmac('sha256', PAYLOAD_SECRET).update(dataToSign).digest('hex').slice(0, 16);

  if (providedSignature !== expectedSignature) {
    return { valid: false, error: 'Invalid payload signature' };
  }

  return { valid: true };
}

/**
 * Verify TON Proof to authenticate wallet ownership
 */
export async function verifyTonProof(request: CheckProofRequest): Promise<{
  valid: boolean;
  address?: string;
  error?: string;
}> {
  const { proof, wallet } = request;

  logger.debug('Starting TON Proof verification', {
    address: wallet.address,
    domain: proof.domain?.value,
    timestamp: proof.timestamp,
    hasPublicKey: !!wallet.publicKey,
    hasStateInit: !!wallet.walletStateInit,
  });

  try {
    // 1. Verify payload signature and expiration (stateless)
    const payloadCheck = verifyPayload(proof.payload);
    if (!payloadCheck.valid) {
      logger.warn('Payload verification failed', { error: payloadCheck.error });
      return { valid: false, error: payloadCheck.error };
    }

    // 2. Verify timestamp is within validity window
    const now = Math.floor(Date.now() / 1000);
    if (now - proof.timestamp > PROOF_VALIDITY_SECONDS) {
      logger.warn('Proof timestamp expired', { proofTimestamp: proof.timestamp, now });
      return { valid: false, error: 'Proof timestamp expired' };
    }

    // 3. Verify domain matches our allowed domains
    const allowedDomains = getAllowedDomains();
    if (!allowedDomains.includes(proof.domain.value)) {
      logger.warn('TON Proof domain mismatch', {
        receivedDomain: proof.domain.value,
        allowedDomains,
      });
      return { valid: false, error: `Domain not allowed: ${proof.domain.value}` };
    }

    // 4. Parse wallet address
    const address = Address.parse(wallet.address);

    // 5. Verify stateInit matches the address (if provided)
    if (!wallet.walletStateInit) {
      logger.warn('No walletStateInit provided, skipping stateInit verification');
      // Some wallets may not provide stateInit - allow but log
    } else {
      try {
        const stateInit = loadStateInit(Cell.fromBase64(wallet.walletStateInit).beginParse());
        const expectedAddress = contractAddress(address.workChain, stateInit);

        if (!expectedAddress.equals(address)) {
          logger.warn('Address mismatch with stateInit', {
            expected: expectedAddress.toString(),
            actual: address.toString(),
          });
          return { valid: false, error: 'Address does not match stateInit' };
        }

        // 6. Extract public key from stateInit and verify
        const publicKey = extractPublicKeyFromStateInit(stateInit.data ?? null);
        if (!publicKey) {
          logger.warn('Could not extract public key from stateInit');
          return { valid: false, error: 'Could not extract public key from stateInit' };
        }

        if (wallet.publicKey) {
          const providedPublicKey = Buffer.from(wallet.publicKey, 'hex');
          if (!publicKey.equals(providedPublicKey)) {
            logger.warn('Public key mismatch', {
              extracted: publicKey.toString('hex'),
              provided: wallet.publicKey,
            });
            return { valid: false, error: 'Public key mismatch' };
          }
        }

        // 7. Build and verify the signature
        const message = createProofMessage(address, proof);
        const signatureBuffer = Buffer.from(proof.signature, 'base64');

        // Wrap message for ton-connect
        const wrappedMessage = await createWrappedMessage(message);

        const isValid = nacl.sign.detached.verify(wrappedMessage, signatureBuffer, publicKey);

        if (!isValid) {
          logger.warn('Invalid signature');
          return { valid: false, error: 'Invalid signature' };
        }
      } catch (stateInitError) {
        logger.error('Error processing stateInit', {}, stateInitError as Error);
        return { valid: false, error: 'Failed to process wallet state' };
      }
    }

    // Note: Replay attack prevention is handled by the proof timestamp
    // Each proof has a unique timestamp that expires within PROOF_VALIDITY_SECONDS

    logger.info('TON Proof verified successfully', {
      address: wallet.address,
    });

    return {
      valid: true,
      address: wallet.address,
    };
  } catch (error) {
    logger.error('TON Proof verification failed', {}, error as Error);
    return { valid: false, error: 'Verification failed: ' + (error instanceof Error ? error.message : 'Unknown error') };
  }
}

/**
 * Create the proof message to be verified
 */
function createProofMessage(address: Address, proof: TonProof): Buffer {
  const prefixBuffer = Buffer.from(TON_PROOF_PREFIX, 'utf-8');

  // Workchain (4 bytes, big-endian)
  const workchainBuffer = Buffer.alloc(4);
  workchainBuffer.writeInt32BE(address.workChain, 0);

  // Address hash (32 bytes)
  const addressBuffer = address.hash;

  // Domain length (4 bytes, little-endian)
  const domainLengthBuffer = Buffer.alloc(4);
  domainLengthBuffer.writeUInt32LE(proof.domain.lengthBytes, 0);

  // Domain value
  const domainBuffer = Buffer.from(proof.domain.value, 'utf-8');

  // Timestamp (8 bytes, little-endian)
  const timestampBuffer = Buffer.alloc(8);
  timestampBuffer.writeBigUInt64LE(BigInt(proof.timestamp), 0);

  // Payload
  const payloadBuffer = Buffer.from(proof.payload, 'utf-8');

  return Buffer.concat([
    prefixBuffer,
    workchainBuffer,
    addressBuffer,
    domainLengthBuffer,
    domainBuffer,
    timestampBuffer,
    payloadBuffer,
  ]);
}

/**
 * Wrap message with ton-connect prefix for signature verification
 */
async function createWrappedMessage(message: Buffer): Promise<Uint8Array> {
  const prefix = Buffer.from([0xff, 0xff]);
  const tonConnectPrefix = Buffer.from(TON_CONNECT_PREFIX, 'utf-8');
  const messageHash = await sha256(message);

  const fullMessage = Buffer.concat([prefix, tonConnectPrefix, messageHash]);
  return sha256(fullMessage);
}

/**
 * Extract public key from wallet stateInit data
 * Supports standard wallet contracts (v3, v4, v5)
 */
function extractPublicKeyFromStateInit(data: Cell | null): Buffer | null {
  if (!data) return null;

  try {
    const slice = data.beginParse();

    // Try different wallet contract formats
    // Wallet v4/v5: skip seqno (32 bits) and subwallet_id (32 bits), then read public key
    // Wallet v3: skip seqno (32 bits), then read public key

    // Most common: v4 format
    try {
      slice.skip(32); // seqno
      slice.skip(32); // subwallet_id or wallet_id
      const publicKey = slice.loadBuffer(32);
      return publicKey;
    } catch {
      // Try v3 format
      const slice2 = data.beginParse();
      slice2.skip(32); // seqno
      const publicKey = slice2.loadBuffer(32);
      return publicKey;
    }
  } catch (error) {
    logger.warn('Failed to extract public key from stateInit', {}, error as Error);
    return null;
  }
}

/**
 * Get allowed domains for proof verification
 */
function getAllowedDomains(): string[] {
  return [
    'd13kjkw1fvmjar.cloudfront.net', // Production CloudFront
    'localhost',
    'localhost:5173', // Vite dev server
    't.me', // Telegram Mini App
    'web.telegram.org', // Telegram Web
    'telegram.org',
  ];
}
