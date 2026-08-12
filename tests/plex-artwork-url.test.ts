import { describe, it, expect } from 'vitest';
import { normalizeThumbPath, PlexAdapter } from '../src/plex/adapter.js';

describe('normalizeThumbPath', () => {
  it('keeps relative library paths unchanged', () => {
    expect(normalizeThumbPath('/library/metadata/2058/thumb/1711355444')).toBe(
      '/library/metadata/2058/thumb/1711355444',
    );
  });

  it('strips query strings from relative paths', () => {
    expect(
      normalizeThumbPath('/library/metadata/2058/thumb/1711355444?X-Plex-Token=abc'),
    ).toBe('/library/metadata/2058/thumb/1711355444');
  });

  it('extracts pathname from absolute plex.direct URLs', () => {
    expect(
      normalizeThumbPath(
        'https://192-168-1-67.c7c0fb89d76a4f84b2dcd31cad977d50.plex.direct:32400/library/metadata/2058/thumb/1711355444?X-Plex-Token=xq4JSF5yxnc5sLNJ_c55',
      ),
    ).toBe('/library/metadata/2058/thumb/1711355444');
  });

  it('prefixes bare relative paths with /', () => {
    expect(normalizeThumbPath('library/metadata/1/thumb/0')).toBe('/library/metadata/1/thumb/0');
  });
});

describe('PlexAdapter.buildArtworkUrl', () => {
  function adapterWithCreds(): PlexAdapter {
    const adapter = new PlexAdapter();
    (adapter as unknown as { baseUrl: string; token: string }).baseUrl = 'http://plex.local:32400';
    (adapter as unknown as { baseUrl: string; token: string }).token = 'server-token';
    return adapter;
  }

  it('joins relative thumbs onto baseUrl with plexa token', () => {
    const url = adapterWithCreds().buildArtworkUrl('/library/metadata/101/thumb/0');
    expect(url).toBe('http://plex.local:32400/library/metadata/101/thumb/0?X-Plex-Token=server-token');
  });

  it('normalizes absolute plex.direct thumbs before joining', () => {
    const url = adapterWithCreds().buildArtworkUrl(
      'https://192-168-1-67.example.plex.direct:32400/library/metadata/2058/thumb/1711355444?X-Plex-Token=embedded',
    );
    expect(url).toBe(
      'http://plex.local:32400/library/metadata/2058/thumb/1711355444?X-Plex-Token=server-token',
    );
  });

  it('strips query from relative thumbs before joining', () => {
    const url = adapterWithCreds().buildArtworkUrl(
      '/library/metadata/101/thumb/0?X-Plex-Token=stale',
    );
    expect(url).toBe('http://plex.local:32400/library/metadata/101/thumb/0?X-Plex-Token=server-token');
  });
});
