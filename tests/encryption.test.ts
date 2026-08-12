import { createHash, createHmac, randomBytes } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  encryptSecret,
  decryptSecret,
  migrateSecretIfLegacy,
} from '../src/config/index.js';

function encryptLegacyXor(plaintext: string, appSecret: string): string {
  const iv = randomBytes(12);
  const key = createHash('sha256').update(appSecret).digest();
  const cipher = createHmac('sha256', key).update(iv).digest();
  const payload = Buffer.from(plaintext, 'utf8');
  const encrypted = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    encrypted[i] = payload[i] ^ cipher[i % cipher.length];
  }
  return `${iv.toString('hex')}:${encrypted.toString('base64')}`;
}

describe('secret migration', () => {
  it('migrates legacy xor secrets to aes-gcm', () => {
    const secret = process.env.APP_SECRET!;
    const legacy = encryptLegacyXor('plex-token-value', secret);
    expect(legacy.startsWith('v1:')).toBe(false);
    const migrated = migrateSecretIfLegacy(legacy, secret);
    expect(migrated.startsWith('v1:')).toBe(true);
    expect(decryptSecret(migrated, secret)).toBe('plex-token-value');
  });

  it('keeps aes secrets unchanged', () => {
    const secret = process.env.APP_SECRET!;
    const enc = encryptSecret('keep-me', secret);
    expect(migrateSecretIfLegacy(enc, secret)).toBe(enc);
  });

  it('decrypts both legacy and aes formats', () => {
    const secret = process.env.APP_SECRET!;
    const legacy = encryptLegacyXor('legacy-token', secret);
    const modern = encryptSecret('modern-token', secret);
    expect(decryptSecret(legacy, secret)).toBe('legacy-token');
    expect(decryptSecret(modern, secret)).toBe('modern-token');
  });
});
