import { describe, expect, it } from 'vitest';
import { normalizePublicHttpsUrl, validatePublicHttpsUrl } from './publicUrl';

describe('normalizePublicHttpsUrl', () => {
  it('trims whitespace and removes trailing slash', () => {
    expect(normalizePublicHttpsUrl('  https://example.com/  ')).toBe('https://example.com');
  });
});

describe('validatePublicHttpsUrl', () => {
  it('allows empty values', () => {
    expect(validatePublicHttpsUrl('')).toBeNull();
    expect(validatePublicHttpsUrl('   ')).toBeNull();
  });

  it('accepts valid HTTPS origins', () => {
    expect(validatePublicHttpsUrl('https://example.com')).toBeNull();
    expect(validatePublicHttpsUrl('https://example.com/')).toBeNull();
    expect(validatePublicHttpsUrl('https://sub.example.com:8443')).toBeNull();
  });

  it('rejects invalid URLs', () => {
    expect(validatePublicHttpsUrl('not-a-url')).toBeTruthy();
    expect(validatePublicHttpsUrl('example.com')).toBeTruthy();
  });

  it('rejects non-HTTPS protocols', () => {
    expect(validatePublicHttpsUrl('http://example.com')).toBe('URL must use HTTPS');
  });

  it('rejects paths', () => {
    expect(validatePublicHttpsUrl('https://example.com/foo')).toBe(
      'Use the origin only — no path after the domain',
    );
  });

  it('rejects /alexa suffix with a specific message', () => {
    expect(validatePublicHttpsUrl('https://example.com/alexa')).toBe(
      'Use the base URL only — do not include /alexa',
    );
  });

  it('rejects query and hash', () => {
    expect(validatePublicHttpsUrl('https://example.com?x=1')).toBe(
      'Use the origin only — no query or hash',
    );
    expect(validatePublicHttpsUrl('https://example.com#frag')).toBe(
      'Use the origin only — no query or hash',
    );
  });
});
