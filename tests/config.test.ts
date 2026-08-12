import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, hashPassword, verifyPassword, signPayload, verifySignature } from '../src/config/index.js';

describe('crypto helpers', () => {
  it('encrypts and decrypts secrets', () => {
    const secret = encryptSecret('plex-token', process.env.APP_SECRET!);
    expect(decryptSecret(secret, process.env.APP_SECRET!)).toBe('plex-token');
  });

  it('hashes and verifies passwords', () => {
    const hash = hashPassword('password123');
    expect(verifyPassword('password123', hash)).toBe(true);
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  it('signs and verifies payloads', () => {
    const sig = signPayload('payload', process.env.APP_SECRET!);
    expect(verifySignature('payload', sig, process.env.APP_SECRET!)).toBe(true);
    expect(verifySignature('payload', 'bad', process.env.APP_SECRET!)).toBe(false);
  });
});
