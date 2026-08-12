import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSignedMediaPath,
  createSignedMediaUrl,
  createSignedSegmentPath,
  toPublicMediaUrl,
  verifySignedToken,
  artUrlForTrack,
  stripPlexTokenFromUrlForTests,
  resolveManifestUriForTests,
} from '../src/media/gateway.js';
import { resetEnvForTests } from '../src/config/index.js';
import { closeDb } from '../src/db/index.js';

describe('signed media urls', () => {
  beforeEach(() => {
    process.env.PUBLIC_URL = 'https://example.com';
    resetEnvForTests();
    closeDb();
  });

  it('creates relative signed paths without requiring PUBLIC_URL', () => {
    delete process.env.PUBLIC_URL;
    resetEnvForTests();
    closeDb();

    const path = createSignedMediaPath('12345', 'audio');
    expect(path).toMatch(/^\/media\/.+\..+$/);
    const match = path.match(/^\/media\/(.+)\.(.+)$/);
    expect(match).toBeTruthy();
    const payload = verifySignedToken(match![1], match![2]);
    expect(payload?.kind).toBe('audio');
    if (payload?.kind === 'audio') expect(payload.ratingKey).toBe('12345');
  });

  it('creates and verifies absolute signed urls when PUBLIC_URL is set', () => {
    const url = createSignedMediaUrl('12345', 'audio');
    expect(url).toBeTruthy();
    expect(url!.startsWith('https://example.com/media/')).toBe(true);
    const match = url!.match(/\/media\/(.+)\.(.+)$/);
    expect(match).toBeTruthy();
    const payload = verifySignedToken(match![1], match![2]);
    expect(payload?.kind).toBe('audio');
    if (payload?.kind === 'audio') expect(payload.ratingKey).toBe('12345');
  });

  it('rejects tampered signatures', () => {
    const path = createSignedMediaPath('12345', 'audio');
    const match = path.match(/\/media\/(.+)\.(.+)$/);
    const payload = verifySignedToken(match![1], 'tampered');
    expect(payload).toBeNull();
  });

  it('absolutizes relative media paths for Alexa', () => {
    const path = createSignedMediaPath('99', 'artwork');
    expect(toPublicMediaUrl(path)).toBe(`https://example.com${path}`);
    expect(toPublicMediaUrl('https://cdn.example/x')).toBe('https://cdn.example/x');
  });

  it('returns null when absolutizing without PUBLIC_URL', () => {
    delete process.env.PUBLIC_URL;
    resetEnvForTests();
    closeDb();
    expect(toPublicMediaUrl('/media/token.sig')).toBeNull();
    expect(createSignedMediaUrl('1', 'audio')).toBeNull();
  });

  it('builds signed playlist track artwork urls only when thumb exists', () => {
    const withArt = artUrlForTrack('42', '/library/metadata/42/thumb/0');
    expect(withArt).toMatch(/^\/artwork\/.+\..+$/);
    const match = withArt!.match(/^\/artwork\/(.+)\.(.+)$/);
    expect(match).toBeTruthy();
    const payload = verifySignedToken(match![1], match![2]);
    expect(payload?.kind).toBe('artwork');
    if (payload?.kind === 'artwork') {
      expect(payload.ratingKey).toBe('42');
      expect(payload.thumb).toBe('/library/metadata/42/thumb/0');
    }

    expect(artUrlForTrack('42')).toBeUndefined();
    expect(artUrlForTrack('42', undefined)).toBeUndefined();
  });

  it('rejects artwork tokens that omit thumb with a clean 404', async () => {
    const { handleArtworkRequest } = await import('../src/media/gateway.js');
    const path = createSignedMediaPath('99', 'artwork');
    const token = path.replace(/^\/artwork\//, '');
    const req = {
      params: { token },
      method: 'GET',
      headers: {},
      on() {},
      off() {},
    } as unknown as import('express').Request;

    const state = { statusCode: 200, body: '' };
    const res = {
      status(code: number) {
        state.statusCode = code;
        return this;
      },
      type(_contentType: string) {
        return this;
      },
      send(body: string) {
        state.body = body;
        return this;
      },
    } as unknown as import('express').Response;

    await handleArtworkRequest(req, res);
    expect(state.statusCode).toBe(404);
    expect(state.body).toBe('Not found');
  });

  it('creates signed segment paths without exposing plex tokens', () => {
    const path = createSignedSegmentPath('/video/:/transcode/universal/session/seg-1.ts');
    expect(path).toMatch(/^\/media\/seg\/.+\..+$/);
    const match = path.match(/^\/media\/seg\/(.+)\.(.+)$/);
    expect(match).toBeTruthy();
    const payload = verifySignedToken(match![1], match![2]);
    expect(payload?.kind).toBe('segment');
    if (payload?.kind === 'segment') {
      expect(payload.path).toBe('/video/:/transcode/universal/session/seg-1.ts');
      expect(JSON.stringify(payload)).not.toContain('X-Plex-Token');
    }
  });

  it('strips plex tokens from upstream urls', () => {
    const stripped = stripPlexTokenFromUrlForTests(
      'https://plex.example.com/video/:/transcode/universal/session/seg-1.ts?X-Plex-Token=secret',
    );
    expect(stripped).toBe('/video/:/transcode/universal/session/seg-1.ts');
    expect(stripped).not.toContain('secret');
  });

  it('resolves relative manifest uris against the manifest base', () => {
    const resolved = resolveManifestUriForTests(
      'https://plex.example.com/music/:/transcode/universal/start.m3u8?session=1',
      'seg-1-v1-a1.ts',
    );
    expect(resolved).toBe('https://plex.example.com/music/:/transcode/universal/seg-1-v1-a1.ts');
  });
});
