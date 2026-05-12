/**
 * SensitiveDataInterceptor
 *
 * Scrubs known sensitive fields from API responses so they are never
 * inadvertently serialised to the client or captured in logs.
 *
 * Rules applied (recursively, depth-limited):
 *  - Field names matching SENSITIVE_KEYS → replaced with "[REDACTED]"
 *  - Fields matching ENCRYPTED_PATTERN (versioned ciphertext) → "[ENCRYPTED]"
 *  - Arrays are walked element-by-element
 *
 * This is defence-in-depth: individual services should also select
 * only necessary fields, but this interceptor removes any stragglers.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Exact field names (lower-cased) to redact from any response object
const SENSITIVE_KEYS = new Set([
  'passwordhash',
  'password',
  'refreshtoken',
  'accesstoken',
  'token',
  'secret',
  'privatekey',
  'clientsecret',
  'apikey',
  'masterkey',
  'encryptionkey',
  'authtoken',
  'sessiontoken',
  'csrftoken',
  'ssn',
  'taxid',
  'bankaccountnumber',
  'routingnumber',
  'cvv',
  'cardnumber',
]);

// Suffix patterns — field names ending with these strings are redacted
const SENSITIVE_SUFFIXES = ['hash', 'secret', 'key', 'token', 'password'];

// Versioned ciphertext pattern produced by EncryptionService
const ENCRYPTED_PATTERN = /^v\d+:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/;

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lower)) return true;
  return SENSITIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function scrub(obj: unknown, depth = 0): unknown {
  if (depth > 10 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => scrub(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'string' && ENCRYPTED_PATTERN.test(value)) {
      result[key] = '[ENCRYPTED]';
    } else if (typeof value === 'object') {
      result[key] = scrub(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => scrub(data)));
  }
}
