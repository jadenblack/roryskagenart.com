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
  connectionVarsSetByOperator,
  describeTarget,
  pickConnectionString,
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

/**
 * `describeTarget` output is written into every backup manifest — which is uploaded off-site next
 * to the data it describes. The one property that must never regress is that it carries no
 * credential, so these tests assert on the *absence* of the password rather than only on the shape.
 */
describe('describeTarget', () => {
  const PASSWORD = 'sup3r-s3cret-pw';

  it('keeps the host, port and database name', () => {
    expect(describeTarget(REMOTE_DIRECT)).toBe('db.orphcusijzkxpxkzapjp.supabase.co:5432/postgres');
    expect(describeTarget(LOCAL)).toBe('127.0.0.1:54322/postgres');
  });

  it('never leaks the password, the user or the scheme', () => {
    const target = `postgresql://postgres.abc:${PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
    const described = describeTarget(target);

    expect(described).toBe('aws-0-us-east-1.pooler.supabase.com:6543/postgres');
    expect(described).not.toContain(PASSWORD);
    expect(described).not.toContain('postgres.abc');
  });

  it('survives a password containing URL-special characters', () => {
    const described = describeTarget(`postgresql://u:p%40ss:w%2Frd@db.example.com:5432/app`);
    expect(described).toBe('db.example.com:5432/app');
    expect(described).not.toContain('%40');
  });

  it('omits the port when the connection string does not name one', () => {
    expect(describeTarget('postgresql://db.example.com/postgres')).toBe('db.example.com/postgres');
  });

  it('reports rather than guesses when it cannot parse the string', () => {
    expect(describeTarget('')).toBe('(unknown)');
    expect(describeTarget('not a url')).toBe('(unparseable connection string)');
  });
});

/**
 * The `.env`-outranks-the-operator trap, measured 2026-09-15.
 *
 * `.env` defines the production `VRCL_SUPA_POSTGRES_PRISMA_URL`, and that name is consulted first.
 * `dotenv` fills in any variable the operator did not export — so a scratch command that exported
 * only `VRCL_SUPA_POSTGRES_URL` was silently outranked, and `run-migrations.ts` wrote to
 * production while the operator believed it was rehearsing locally.
 */
describe('pickConnectionString', () => {
  const ENV_AFTER_DOTENV = {
    // What `.env` contributes — the production database.
    VRCL_SUPA_POSTGRES_PRISMA_URL: 'postgresql://postgres:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
    // What the operator exported for a scratch run.
    VRCL_SUPA_POSTGRES_URL: LOCAL,
  };

  it('lets the operator-exported variable win, even when a higher-priority name is present', () => {
    // The operator exported only the second name. Before the fix this returned the production URL.
    expect(pickConnectionString(ENV_AFTER_DOTENV, ['VRCL_SUPA_POSTGRES_URL'])).toBe(LOCAL);
  });

  it('keeps the historical order when the operator exported nothing', () => {
    expect(pickConnectionString(ENV_AFTER_DOTENV, [])).toBe(ENV_AFTER_DOTENV.VRCL_SUPA_POSTGRES_PRISMA_URL);
  });

  it('prefers PRISMA_URL when the operator exported both', () => {
    const picked = pickConnectionString(ENV_AFTER_DOTENV, [
      'VRCL_SUPA_POSTGRES_PRISMA_URL',
      'VRCL_SUPA_POSTGRES_URL',
    ]);
    expect(picked).toBe(ENV_AFTER_DOTENV.VRCL_SUPA_POSTGRES_PRISMA_URL);
  });

  it('falls through an operator variable that is set but empty', () => {
    // An exported-but-empty variable must not shadow a usable one.
    const env = { ...ENV_AFTER_DOTENV, VRCL_SUPA_POSTGRES_URL: '' };
    expect(pickConnectionString(env, ['VRCL_SUPA_POSTGRES_URL'])).toBe(
      ENV_AFTER_DOTENV.VRCL_SUPA_POSTGRES_PRISMA_URL
    );
  });

  it('returns an empty string when nothing is set, so resolvePoolTarget can refuse', () => {
    expect(pickConnectionString({}, [])).toBe('');
    expect(() => resolvePoolTarget(pickConnectionString({}, []))).toThrow(TargetSafetyError);
  });

  it('honours the legacy POSTGRES_URL only as a last resort', () => {
    expect(pickConnectionString({ POSTGRES_URL: LOCAL }, [])).toBe(LOCAL);
    expect(pickConnectionString({ POSTGRES_URL: LOCAL, ...ENV_AFTER_DOTENV }, [])).toBe(
      ENV_AFTER_DOTENV.VRCL_SUPA_POSTGRES_PRISMA_URL
    );
  });

  it('connectionVarsSetByOperator reports only what is actually present', () => {
    expect(connectionVarsSetByOperator({})).toEqual([]);
    expect(connectionVarsSetByOperator(ENV_AFTER_DOTENV)).toEqual([
      'VRCL_SUPA_POSTGRES_PRISMA_URL',
      'VRCL_SUPA_POSTGRES_URL',
    ]);
  });
});
