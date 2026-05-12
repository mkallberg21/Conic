/**
 * Healthcare-grade AES-256-GCM field-level encryption service.
 *
 * Design:
 *  - AES-256-GCM with a unique 96-bit IV per encryption operation.
 *  - Ciphertext format: `<version>:<b64(iv)>:<b64(ciphertext)>:<b64(authTag)>`
 *    The version prefix enables zero-downtime key rotation.
 *  - HKDF (SHA-256) is used to derive purpose-specific sub-keys from the
 *    master key so the same master key can safely protect multiple fields.
 *  - Deterministic encryption (`encryptDeterministic`) uses HKDF-derived IV
 *    per (field, value) pair — allows exact-match queries on encrypted columns
 *    while still being semantically secure within each column namespace.
 *
 * Usage:
 *   encrypt(plaintext, field)            — unique IV, use for storage
 *   decrypt(ciphertext, field)            — auto-decodes any supported version
 *   encryptDeterministic(plaintext, field) — stable CT for indexed/searchable columns
 *   hash(value)                           — one-way blind index (HMAC-SHA256)
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;       // 96-bit IV recommended for GCM
const TAG_BYTES = 16;      // 128-bit auth tag (GCM default)
const KEY_BYTES = 32;      // AES-256

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  /** Active key version used for NEW encryptions. Decryption accepts all versions. */
  private activeVersion!: string;
  /** Map of version string → 32-byte Buffer */
  private keyring = new Map<string, Buffer>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    // Load all versioned keys from environment.
    // Example env vars: ENCRYPTION_KEY_V1=<64 hex chars>  ENCRYPTION_KEY_V2=...
    // Set ENCRYPTION_ACTIVE_VERSION to the version to use for new writes.
    const activeVersion = this.config.get<string>('encryption.activeVersion', 'v1');
    const keyEnvPrefix = 'ENCRYPTION_KEY_';

    let loaded = 0;
    for (let v = 1; v <= 10; v++) {
      const envKey = `${keyEnvPrefix}V${v}`;
      const raw = process.env[envKey];
      if (raw) {
        if (raw.length !== 64) {
          throw new Error(
            `${envKey} must be exactly 64 hex characters (256 bits). Generate with: openssl rand -hex 32`,
          );
        }
        this.keyring.set(`v${v}`, Buffer.from(raw, 'hex'));
        loaded++;
      }
    }

    if (loaded === 0) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'No encryption keys found. Set ENCRYPTION_KEY_V1 in environment. ' +
          'Generate with: openssl rand -hex 32',
        );
      }
      // Dev fallback — deterministic key derived from a constant so restart is safe
      this.logger.warn(
        '⚠️  No ENCRYPTION_KEY_V1 set. Using insecure dev key. NEVER use in production.',
      );
      this.keyring.set('v1', Buffer.alloc(32, 'dev-only-key-do-not-use-in-prod'));
    }

    if (!this.keyring.has(activeVersion)) {
      throw new Error(
        `ENCRYPTION_ACTIVE_VERSION="${activeVersion}" but that key is not loaded. ` +
        `Ensure ENCRYPTION_KEY_${activeVersion.toUpperCase()} is set.`,
      );
    }

    this.activeVersion = activeVersion;
    this.logger.log(
      `EncryptionService ready — active: ${activeVersion}, keyring: [${[...this.keyring.keys()].join(', ')}]`,
    );
  }

  /** Encrypt plaintext with a random IV. Returns versioned ciphertext string. */
  encrypt(plaintext: string, field = 'default'): string {
    const iv = randomBytes(IV_BYTES);
    return this.encryptWithIv(plaintext, field, iv, this.activeVersion);
  }

  /**
   * Deterministic encryption: same plaintext + field → same ciphertext.
   * Enables exact-match queries (e.g., lookup by encrypted email).
   * IV is derived via HKDF(masterKey, field || plaintext) — unique per field.
   */
  encryptDeterministic(plaintext: string, field = 'default'): string {
    const masterKey = this.keyring.get(this.activeVersion)!;
    const info = Buffer.from(`deterministic:${field}`);
    const salt = Buffer.from(plaintext, 'utf8');
    // Derive a stable IV from the plaintext + field using HKDF
    const derivedIv = Buffer.from(
      hkdfSync('sha256', masterKey, salt, info, IV_BYTES),
    );
    return this.encryptWithIv(plaintext, field, derivedIv, this.activeVersion);
  }

  /** Decrypt a versioned ciphertext. Handles any version present in keyring. */
  decrypt(ciphertext: string, field = 'default'): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted field format');
    }
    const [version, ivB64, dataB64, tagB64] = parts;
    const key = this.keyring.get(version);
    if (!key) {
      throw new Error(
        `Cannot decrypt — key version "${version}" not in keyring. ` +
        'Has a key been removed before re-encrypting data?',
      );
    }

    const iv = Buffer.from(ivB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');

    const derivedKey = this.deriveFieldKey(key, field);
    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);

    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString('utf8');
  }

  /**
   * Returns true if `ciphertext` encodes `plaintext` without revealing the
   * plaintext. Uses timing-safe comparison.
   */
  verify(plaintext: string, ciphertext: string, field = 'default'): boolean {
    try {
      const decrypted = this.decrypt(ciphertext, field);
      return timingSafeEqual(Buffer.from(decrypted), Buffer.from(plaintext));
    } catch {
      return false;
    }
  }

  /**
   * HMAC-SHA256 blind index — one-way, repeatable.
   * Use this to create a searchable index column for encrypted PII
   * (e.g. `emailIndex = hash(email.toLowerCase())`).
   */
  hash(value: string, field = 'default'): string {
    const key = this.keyring.get(this.activeVersion)!;
    const derivedKey = this.deriveFieldKey(key, `blind-index:${field}`);
    return createHmac('sha256', derivedKey)
      .update(Buffer.from(value.toLowerCase().trim(), 'utf8'))
      .digest('hex');
  }

  /** Whether a string looks like it was produced by this service. */
  isEncrypted(value: string): boolean {
    return /^v\d+:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/.test(value);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private encryptWithIv(
    plaintext: string,
    field: string,
    iv: Buffer,
    version: string,
  ): string {
    const masterKey = this.keyring.get(version)!;
    const derivedKey = this.deriveFieldKey(masterKey, field);
    const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plaintext, 'utf8')),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      version,
      iv.toString('base64'),
      encrypted.toString('base64'),
      tag.toString('base64'),
    ].join(':');
  }

  /** HKDF-derive a field-specific 256-bit key from the master key. */
  private deriveFieldKey(masterKey: Buffer, field: string): Buffer {
    const info = Buffer.from(`conic:field:${field}`, 'utf8');
    return Buffer.from(hkdfSync('sha256', masterKey, Buffer.alloc(0), info, KEY_BYTES));
  }
}
