import { randomUUID } from 'node:crypto';
import { MyPlexAccount, MyPlexPinLogin } from '@ctrl/plex';
import { decryptSecret, encryptSecret, getEnv } from '../config/index.js';
import {
  clearPlexOAuth,
  getPlexClientId,
  getPlexOAuth,
  getSettings,
  savePlexOAuth,
  setPlexClientId,
  updateSettings,
  type PlexOAuthRow,
} from '../db/index.js';
import { getPlexAccountToken } from '../services/settings.js';
import { plexAdapter } from './adapter.js';

export interface PlexOAuthStart {
  authId: string;
  authUrl: string;
  expiresAt: string;
}

export interface PlexServerOption {
  clientIdentifier: string;
  name: string;
  owned: boolean;
  product: string;
  platform: string;
  presence: boolean;
  connections: { uri: string; local: boolean; relay: boolean }[];
}

export interface PlexOAuthStatus {
  status: 'pending' | 'completed' | 'expired' | 'error';
  authUrl?: string;
  expiresAt?: string;
  accountEmail?: string;
  servers?: PlexServerOption[];
  error?: string;
}

function getOrCreateClientId(): string {
  const existing = getPlexClientId();
  if (existing) return existing;
  const id = randomUUID();
  setPlexClientId(id);
  return id;
}

export async function startPlexOAuth(): Promise<PlexOAuthStart> {
  const clientIdentifier = getOrCreateClientId();
  const login = await MyPlexPinLogin.create({
    clientIdentifier,
    mode: 'oauth',
    product: 'Plexa',
  });
  const authId = randomUUID();
  const authUrl = login.oauthUrl();
  savePlexOAuth({
    id: authId,
    pin_id: login.id,
    client_identifier: clientIdentifier,
    auth_url: authUrl,
    status: 'pending',
    account_token_enc: null,
    expires_at: login.expiresAt.toISOString(),
  });
  return { authId, authUrl, expiresAt: login.expiresAt.toISOString() };
}

async function listServers(accountToken: string): Promise<PlexServerOption[]> {
  const account = await new MyPlexAccount({ token: accountToken }).connect();
  const resources = await account.resources();
  return resources
    .filter((r) => r.provides.includes('server'))
    .map((r) => ({
      clientIdentifier: r.clientIdentifier,
      name: r.name,
      owned: r.owned,
      product: r.product,
      platform: r.platform,
      presence: r.presence,
      connections: r.connections.map((c) => ({
        uri: c.uri,
        local: c.local,
        relay: c.relay,
      })),
    }));
}

function resolveAccountToken(authId?: string): string {
  if (authId) {
    const row = getPlexOAuth(authId);
    if (row?.account_token_enc) {
      return decryptSecret(row.account_token_enc, getEnv().APP_SECRET);
    }
  }
  const stored = getPlexAccountToken();
  if (stored) return stored;
  throw new Error('Plex account not connected');
}

async function completeOAuth(row: PlexOAuthRow): Promise<PlexOAuthStatus> {
  const login = await MyPlexPinLogin.resume({
    id: row.pin_id,
    clientIdentifier: row.client_identifier,
    mode: 'oauth',
    product: 'Plexa',
  });
  const auth = await login.check();
  if (!auth?.token) {
    if (new Date(row.expires_at) < new Date()) {
      savePlexOAuth({ ...row, status: 'expired' });
      return { status: 'expired' };
    }
    return { status: 'pending', authUrl: row.auth_url, expiresAt: row.expires_at };
  }

  const env = getEnv();
  const tokenEnc = encryptSecret(auth.token, env.APP_SECRET);
  savePlexOAuth({ ...row, status: 'completed', account_token_enc: tokenEnc });
  updateSettings({ plex_account_token_enc: tokenEnc });

  const account = await new MyPlexAccount({ token: auth.token }).connect();
  const servers = await listServers(auth.token);

  return {
    status: 'completed',
    accountEmail: account.email,
    servers,
  };
}

export async function getPlexOAuthStatus(authId: string): Promise<PlexOAuthStatus> {
  const row = getPlexOAuth(authId);
  if (!row) return { status: 'error', error: 'OAuth session not found' };
  if (row.status === 'completed' && row.account_token_enc) {
    const token = decryptSecret(row.account_token_enc, getEnv().APP_SECRET);
    if (!getSettings().plex_account_token_enc) {
      updateSettings({ plex_account_token_enc: row.account_token_enc });
    }
    const account = await new MyPlexAccount({ token }).connect();
    const servers = await listServers(token);
    return { status: 'completed', accountEmail: account.email, servers };
  }
  if (row.status === 'expired') return { status: 'expired' };
  return completeOAuth(row);
}

export async function listPlexServers(): Promise<PlexServerOption[]> {
  const token = getPlexAccountToken();
  if (!token) return [];
  return listServers(token);
}

export async function selectPlexServer(
  clientIdentifier: string,
  authId?: string,
): Promise<{ url: string; name: string; email?: string; libraries: { key: string; title: string; type: string }[] }> {
  const accountToken = resolveAccountToken(authId);
  const account = await new MyPlexAccount({ token: accountToken }).connect();
  const resources = await account.resources();
  const resource = resources.find((r) => r.clientIdentifier === clientIdentifier);
  if (!resource) throw new Error('Plex server not found');

  const server = await resource.connect();
  const url = server.baseurl.replace(/\/$/, '');
  const token = resource.accessToken;
  const env = getEnv();

  updateSettings({
    plex_url: url,
    plex_token_enc: encryptSecret(token, env.APP_SECRET),
    plex_account_token_enc: encryptSecret(accountToken, env.APP_SECRET),
    plex_account_email: account.email ?? null,
    plex_server_name: resource.name,
    plex_server_machine_id: resource.clientIdentifier,
    music_library_id: null,
  });

  await plexAdapter.connect(url, token);
  const libraries = await plexAdapter.listLibraries();
  if (authId) clearPlexOAuth(authId);

  return {
    url,
    name: resource.name,
    email: account.email,
    libraries,
  };
}

export function disconnectPlex(): void {
  updateSettings({
    plex_url: null,
    plex_token_enc: null,
    plex_account_token_enc: null,
    plex_account_email: null,
    plex_server_name: null,
    plex_server_machine_id: null,
    music_library_id: null,
  });
}

export async function loadLibrariesForCurrentPlex(): Promise<{ key: string; title: string; type: string }[]> {
  const creds = await ensureConnectedFromSettings();
  if (!creds) return [];
  return plexAdapter.listLibraries();
}

async function ensureConnectedFromSettings(): Promise<{ url: string; token: string } | null> {
  const { getPlexCredentials } = await import('../services/settings.js');
  const creds = getPlexCredentials();
  if (!creds) return null;
  await plexAdapter.connect(creds.url, creds.token);
  return creds;
}
