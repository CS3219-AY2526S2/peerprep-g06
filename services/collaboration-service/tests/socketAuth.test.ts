import { describe, expect, it } from 'vitest';
import { getBearerToken } from '../src/services/socketAuth';

describe('socketAuth', () => {
  it('prefers the auth payload token when present', () => {
    expect(
      getBearerToken({
        handshake: {
          auth: { token: 'auth-token' },
          headers: { authorization: 'Bearer header-token' },
        },
      }),
    ).toBe('auth-token');
  });

  it('falls back to the bearer authorization header', () => {
    expect(
      getBearerToken({
        handshake: {
          headers: { authorization: 'Bearer header-token' },
        },
      }),
    ).toBe('header-token');
  });

  it('returns null when no valid token is present', () => {
    expect(
      getBearerToken({
        handshake: {
          auth: { token: '' },
          headers: { authorization: 'Token abc' },
        },
      }),
    ).toBeNull();
  });
});
