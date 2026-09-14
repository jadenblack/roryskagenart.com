import { describe, it, expect, beforeEach, vi } from 'vitest';
// `bareOrigin` is a pure helper, so a static import is fine here; the hand-off
// capture below needs a fresh module registry instead (see loadWithHash).
import { bareOrigin } from '../lib/authRedirect';

/**
 * `src/lib/authRedirect.ts` captures state from `window.location.hash` at module
 * evaluation time, so each case needs a fresh module registry with the fragment
 * already in place — exactly how `src/main.tsx` gets it before supabase-js
 * blanks the hash.
 */
async function loadWithHash(hash: string) {
  vi.resetModules();
  window.location.hash = hash;
  return import('../lib/authRedirect');
}

beforeEach(() => {
  window.location.hash = '';
});

describe('auth hand-off capture', () => {
  it('recognizes an invitation link', async () => {
    const mod = await loadWithHash(
      '#access_token=eyJhbGciOi&expires_in=3600&refresh_token=abc&token_type=bearer&type=invite'
    );
    expect(mod.getAuthHandoff()).toBe('invite');
  });

  it('recognizes a password-recovery link', async () => {
    const mod = await loadWithHash('#access_token=tok&type=recovery&token_type=bearer');
    expect(mod.getAuthHandoff()).toBe('recovery');
  });

  it('treats a signup confirmation as an invitation', async () => {
    const mod = await loadWithHash('#access_token=tok&type=signup');
    expect(mod.getAuthHandoff()).toBe('invite');
  });

  it('reports no hand-off for an ordinary visit', async () => {
    for (const hash of ['', '#home', '#/admin', '#artwork/gianondor', '#catalog']) {
      const mod = await loadWithHash(hash);
      expect(mod.getAuthHandoff()).toBeNull();
      expect(mod.getAuthHandoffError()).toBeNull();
    }
  });

  it('captures the reason when an emailed link has expired', async () => {
    const mod = await loadWithHash(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    );
    expect(mod.getAuthHandoff()).toBeNull();
    expect(mod.getAuthHandoffError()).toBe('Email link is invalid or has expired');
  });

  it('falls back to the error code when no description is present', async () => {
    const mod = await loadWithHash('#error=access_denied&error_code=otp_expired');
    expect(mod.getAuthHandoffError()).toBe('otp_expired');
  });

  it('clears the hand-off once consumed', async () => {
    const mod = await loadWithHash('#access_token=tok&type=invite');
    expect(mod.getAuthHandoff()).toBe('invite');
    mod.clearAuthHandoff();
    expect(mod.getAuthHandoff()).toBeNull();
    expect(mod.getAuthHandoffError()).toBeNull();
  });
});

describe('bareOrigin', () => {
  it('strips the hash route that would swallow the session fragment', () => {
    // The whole reason the reset redirect is not `${origin}/#/admin/reset`.
    expect(bareOrigin('https://roryskagenart.com/#/admin/reset')).toBe('https://roryskagenart.com/');
  });

  it('normalizes an origin with and without a trailing slash', () => {
    expect(bareOrigin('https://roryskagenart.com')).toBe('https://roryskagenart.com/');
    expect(bareOrigin('https://roryskagenart.com/')).toBe('https://roryskagenart.com/');
  });

  it('keeps a port intact for local development', () => {
    expect(bareOrigin('http://localhost:3000/#/admin')).toBe('http://localhost:3000/');
  });
});
