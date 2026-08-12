import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATA_DIR: z.string().default('./data'),
  APP_SECRET: z.string().min(16),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().default('changeme'),
  PLEX_URL: z.string().url().optional(),
  PLEX_TOKEN: z.string().optional(),
  PUBLIC_URL: z.string().url().optional(),
  ALEXA_SKILL_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

export function resetEnvForTests(): void {
  cachedEnv = null;
}

export function getDataDir(): string {
  const dir = resolve(getEnv().DATA_DIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDbPath(): string {
  return resolve(getDataDir(), 'plexa.db');
}

function deriveKey(appSecret: string): Buffer {
  return createHash('sha256').update(appSecret).digest();
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, 'hex');
  const testHash = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, testHash);
}

function decryptLegacyXor(encoded: string, appSecret: string): string {
  const [ivHex, dataBase64] = encoded.split(':');
  if (!ivHex || !dataBase64) throw new Error('Invalid encrypted secret');
  const iv = Buffer.from(ivHex, 'hex');
  const key = deriveKey(appSecret);
  const cipher = createHmac('sha256', key).update(iv).digest();
  const encrypted = Buffer.from(dataBase64, 'base64');
  const decrypted = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ cipher[i % cipher.length];
  }
  return decrypted.toString('utf8');
}

export function encryptSecret(plaintext: string, appSecret: string): string {
  const key = deriveKey(appSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(encoded: string, appSecret: string): string {
  if (encoded.startsWith('v1:')) {
    const parts = encoded.split(':');
    if (parts.length !== 4) throw new Error('Invalid encrypted secret');
    const [, ivHex, tagHex, dataBase64] = parts;
    const key = deriveKey(appSecret);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataBase64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
  return decryptLegacyXor(encoded, appSecret);
}

export function migrateSecretIfLegacy(encoded: string, appSecret: string): string {
  if (encoded.startsWith('v1:')) return encoded;
  const plaintext = decryptLegacyXor(encoded, appSecret);
  return encryptSecret(plaintext, appSecret);
}

export function signPayload(payload: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(payload).digest('base64url');
}

export function verifySignature(payload: string, signature: string, appSecret: string): boolean {
  const expected = signPayload(payload, appSecret);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}
