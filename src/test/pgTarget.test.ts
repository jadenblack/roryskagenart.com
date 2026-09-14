/**
 * Coverage for the shared PostgreSQL connection-target rule (scripts/lib/pgTarget.ts).
 *
 * WHY THIS EXISTS
 * Every script in `scripts/` used to hardcode `ssl: { rejectUnauthorized: false }`. That is
 * correct for the hosted Supabase database and wrong for the local scratch database that
 * `supabase start` serves on 127.0.0.1:54322, which offers no TLS — connecting to it failed with
 * "The server does not support SSL connections", which made the whole scratch-database workflow
 * (ADR 0001 Phase A verification, the pre-migration checklist, risk R-08) impossible.
 *
 * The rule is now in one place, and these tests lock down BOTH directions of it, because getting
 * either wrong is expensive:
 *
 *   1. A loopback target must get NO TLS, or local development is impossible.
 *   2. A remote target must KEEP `rejectUnauthorized: false`, or every production script breaks.
 *   3. Credentials must never leak into the `host` used for logging.
 *
 * Zero tokens: no database, no network.
 */
import { describe, expect, it } from 'vitest';
import {
  TargetSafetyError,
  classifyTarget,
  resolvePoolTarget,
  stripQueryParams,
} from '../../scripts/lib/pgTarget';

const LOCAL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const REMOTE_DIRECT = 'postgresql://postgres:pw@db.orphcusijzkxpxkzapjp.supabase.co:5432/postgres';
const REMOTE_POOLER = 'postgresql://postgres.pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

describe('classifyTarget', () => {
  it('treats every loopback form as local', () => {
    for (const url of [
      LOCAL,
      'postgresql://postgres:postgres@localhost:54322/postgres',
      // Regression: WHATWG URL serialises an IPv6 host WITH brackets, so this is '[::1]'.
      // The previous bare `'::1'` comparison could never match and misclassified it as remote.
      'postgresql://postgres:postgres@[::1]:54322/postgres',
      // Regression: `postgresql:` is not a WHATWG special scheme, so the host may keep its case.
      'postgresql://postgres:postgres@LOCALHOST:54322/postgres',
      // A container reaching the host is still reaching this machine.
      'postgresql://postgres:postgres@host.docker.internal:54322/postgres',
    ]) {
      expect(classifyTarget(url).isRemote, url).toBe(false);
    }
  });

  it('treats both Supabase host shapes as remote', () => {
    expect(classifyTarget(REMOTE_DIRECT).isRemote).toBe(true);
    expect(classifyTarget(REMOTE_POOLER).isRemote).toBe(true);
  });

  it('reports the host without credentials', () => {
    const target = classifyTarget(REMOTE_DIRECT);
    expect(target.host).toBe('db.orphcusijzkxpxkzapjp.supabase.co');
    expect(target.host).not.toContain('pw');
  });

  it('throws on an unparseable connection string rather than guessing', () => {
    expect(() => classifyTarget('not-a-url')).toThrow(TargetSafetyError);
    expect(() => classifyTarget('')).toThrow(TargetSafetyError);
  });
});

describe('resolvePoolTarget — the rule that unblocked local development', () => {
  it('gives a loopback target NO TLS', () => {
    const target = resolvePoolTarget(LOCAL);
    expect(target.ssl).toBeUndefined();
    expect(target.isRemote).toBe(false);
  });

  it('keeps the hosted-database TLS setting for a remote target', () => {
    for (const url of [REMOTE_DIRECT, REMOTE_POOLER]) {
      expect(resolvePoolTarget(url).ssl, url).toEqual({ rejectUnauthorized: false });
    }
  });

  it('strips query parameters so the explicit ssl setting is authoritative', () => {
    const target = resolvePoolTarget(`${LOCAL}?sslmode=require`);
    expect(target.connectionString).toBe(LOCAL);
    expect(target.ssl).toBeUndefined();
  });

  it('refuses an empty connection string instead of connecting somewhere unintended', () => {
    expect(() => resolvePoolTarget('')).toThrow(TargetSafetyError);
  });

  it('never puts credentials in the loggable host', () => {
    expect(resolvePoolTarget(REMOTE_DIRECT).host).not.toContain('pw');
  });
});

describe('stripQueryParams', () => {
  it('leaves a string with no query parameters untouched', () => {
    expect(stripQueryParams(LOCAL)).toBe(LOCAL);
  });

  it('removes everything from the first question mark', () => {
    expect(stripQueryParams('postgresql://h/db?sslmode=require&foo=bar')).toBe('postgresql://h/db');
  });
});
