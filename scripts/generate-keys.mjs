#!/usr/bin/env node
/**
 * generate-keys.mjs
 *
 * Generates all secrets needed for a secure Conic deployment.
 * Run once: node scripts/generate-keys.mjs >> .env
 *
 * Output:
 *   JWT_PRIVATE_KEY   — RS4096 private key (base64 PEM) for signing JWTs
 *   JWT_PUBLIC_KEY    — Corresponding public key for verification
 *   JWT_REFRESH_SECRET — 512-bit random secret for refresh tokens
 *   ENCRYPTION_KEY_V1  — 256-bit AES master key for field-level encryption
 *   JWT_SECRET         — 256-bit fallback (only needed without RS256 keys)
 */

import { generateKeyPairSync, randomBytes } from 'crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const toB64 = (pem) => Buffer.from(pem).toString('base64');

console.log('# ── JWT (RS256) ─────────────────────────────────────────────────────');
console.log(`JWT_PRIVATE_KEY=${toB64(privateKey)}`);
console.log(`JWT_PUBLIC_KEY=${toB64(publicKey)}`);
console.log(`JWT_REFRESH_SECRET=${randomBytes(64).toString('hex')}`);
console.log(`JWT_EXPIRES_IN=15m`);
console.log(`JWT_REFRESH_EXPIRES_IN=7d`);
console.log('');
console.log('# ── AES-256-GCM Field Encryption ────────────────────────────────────');
console.log(`ENCRYPTION_KEY_V1=${randomBytes(32).toString('hex')}`);
console.log(`ENCRYPTION_ACTIVE_VERSION=v1`);
console.log('');
console.log('# ── Legacy symmetric fallback (dev only, ignored when RS256 set) ────');
console.log(`JWT_SECRET=${randomBytes(32).toString('hex')}`);
