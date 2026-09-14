import { describe, it, expect } from 'vitest';
import {
  buildAuthRedirect,
  buildUserPatch,
  classifyUserState,
  decideMutation,
  extractActionLink,
  normalizeEmail,
  normalizeRole,
} from '../../server/lib/userAdmin';
import { roleAtLeast } from '../lib/roles';

const NOW = Date.parse('2026-09-14T12:00:00Z');

describe('classifyUserState', () => {
  it('treats an invited-but-unconfirmed account as a pending invitation', () => {
    const state = classifyUserState(
      { invited_at: '2026-09-10T10:00:00Z', confirmation_sent_at: '2026-09-10T10:00:00Z' },
      NOW
    );
    expect(state).toMatchObject({ confirmed: false, invitePending: true, banned: false });
  });

  it('treats a confirmed account as active even if it was once invited', () => {
    const state = classifyUserState(
      {
        invited_at: '2026-09-01T10:00:00Z',
        email_confirmed_at: '2026-09-02T10:00:00Z',
        last_sign_in_at: '2026-09-12T10:00:00Z',
      },
      NOW
    );
    expect(state).toMatchObject({ confirmed: true, invitePending: false });
  });

  it('does not call an untouched account a pending invitation', () => {
    expect(classifyUserState({}, NOW).invitePending).toBe(false);
  });

  it('only reports a ban while the window is still open', () => {
    expect(classifyUserState({ banned_until: '2027-01-01T00:00:00Z' }, NOW).banned).toBe(true);
    expect(classifyUserState({ banned_until: '2026-01-01T00:00:00Z' }, NOW).banned).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims a valid address', () => {
    expect(normalizeEmail('  Curator@RorySkagen.COM ')).toBe('curator@roryskagen.com');
  });

  it('rejects malformed input', () => {
    for (const value of ['', 'nope', 'a@b', '@b.com', 'a b@c.com', 42, null, undefined]) {
      expect(normalizeEmail(value)).toBeNull();
    }
  });
});

describe('normalizeRole', () => {
  it('accepts only the three studio roles', () => {
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('editor')).toBe('editor');
    expect(normalizeRole('viewer')).toBe('viewer');
    expect(normalizeRole('owner')).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
  });
});

describe('roleAtLeast', () => {
  it('orders viewer < editor < admin', () => {
    expect(roleAtLeast('viewer', 'viewer')).toBe(true);
    expect(roleAtLeast('viewer', 'editor')).toBe(false);
    expect(roleAtLeast('editor', 'editor')).toBe(true);
    expect(roleAtLeast('editor', 'admin')).toBe(false);
    expect(roleAtLeast('admin', 'admin')).toBe(true);
  });

  it('treats an unknown role as below every level', () => {
    expect(roleAtLeast(undefined, 'viewer')).toBe(false);
    expect(roleAtLeast('superuser', 'viewer')).toBe(false);
  });
});

describe('buildUserPatch', () => {
  it('accepts and normalizes the four editable fields', () => {
    const result = buildUserPatch({
      role: 'editor',
      isActive: false,
      name: '  Studio Curator ',
      email: 'Curator@RorySkagen.com',
    });
    expect(result.error).toBeUndefined();
    expect(result.patch).toEqual({
      role: 'editor',
      isActive: false,
      name: 'Studio Curator',
      email: 'curator@roryskagen.com',
    });
  });

  it('rejects an invalid role rather than silently downgrading', () => {
    expect(buildUserPatch({ role: 'owner' }).error).toMatch(/invalid role/i);
  });

  it('rejects a non-boolean active flag', () => {
    expect(buildUserPatch({ isActive: 'yes' }).error).toMatch(/true or false/i);
  });

  it('rejects an invalid email', () => {
    expect(buildUserPatch({ email: 'not-an-email' }).error).toMatch(/valid email/i);
  });

  it('rejects an over-long name', () => {
    expect(buildUserPatch({ name: 'x'.repeat(121) }).error).toMatch(/120 characters/i);
  });

  it('rejects a body with nothing to update', () => {
    expect(buildUserPatch({}).error).toMatch(/no updatable fields/i);
    expect(buildUserPatch(null).error).toMatch(/no fields provided/i);
  });

  it('ignores unknown keys instead of failing', () => {
    const result = buildUserPatch({ role: 'viewer', somethingElse: true });
    expect(result.patch).toEqual({ role: 'viewer' });
  });
});

describe('decideMutation', () => {
  const target = { id: 'u-2', email: 'rio@riolabs.ai', role: 'admin', isActive: true };

  it('blocks an administrator from changing their own role', () => {
    const decision = decideMutation({
      action: 'role',
      actorId: 'u-2',
      target,
      activeAdminCount: 3,
      nextRole: 'editor',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/own role/i);
  });

  it('blocks an administrator from deactivating or deleting themselves', () => {
    for (const action of ['deactivate', 'delete'] as const) {
      const decision = decideMutation({ action, actorId: 'u-2', target, activeAdminCount: 3 });
      expect(decision.allowed).toBe(false);
    }
  });

  it('blocks removing the last active administrator', () => {
    const decision = decideMutation({
      action: 'role',
      actorId: 'u-1',
      target,
      activeAdminCount: 1,
      nextRole: 'editor',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/only active administrator/i);
  });

  it('blocks deactivating or deleting the last active administrator', () => {
    for (const action of ['deactivate', 'delete'] as const) {
      expect(
        decideMutation({ action, actorId: 'u-1', target, activeAdminCount: 1 }).allowed
      ).toBe(false);
    }
  });

  it('allows the last administrator to be changed once a second admin exists', () => {
    expect(
      decideMutation({
        action: 'role',
        actorId: 'u-1',
        target,
        activeAdminCount: 2,
        nextRole: 'editor',
      }).allowed
    ).toBe(true);
  });

  it('always allows a password reset — including on your own account', () => {
    expect(
      decideMutation({ action: 'reset-password', actorId: 'u-2', target, activeAdminCount: 1 }).allowed
    ).toBe(true);
  });

  it('allows demoting a viewer or an inactive administrator', () => {
    expect(
      decideMutation({
        action: 'role',
        actorId: 'u-1',
        target: { id: 'u-3', email: 'v@x.com', role: 'viewer', isActive: true },
        activeAdminCount: 1,
        nextRole: 'viewer',
      }).allowed
    ).toBe(true);

    expect(
      decideMutation({
        action: 'delete',
        actorId: 'u-1',
        target: { id: 'u-4', email: 'a@x.com', role: 'admin', isActive: false },
        activeAdminCount: 1,
      }).allowed
    ).toBe(true);
  });

  it('allows promoting an administrator to administrator (no-op)', () => {
    expect(
      decideMutation({
        action: 'role',
        actorId: 'u-1',
        target,
        activeAdminCount: 1,
        nextRole: 'admin',
      }).allowed
    ).toBe(true);
  });
});

describe('extractActionLink', () => {
  it('reads the action link out of a generateLink response', () => {
    const url = 'https://project.supabase.co/auth/v1/verify?token=abc&type=invite';
    expect(extractActionLink({ data: { properties: { action_link: url } } })).toBe(url);
  });

  it('returns null for an unexpected shape instead of throwing', () => {
    for (const input of [null, undefined, {}, { data: null }, { data: { properties: {} } }]) {
      expect(extractActionLink(input)).toBeNull();
    }
  });

  it('rejects a non-URL value', () => {
    expect(extractActionLink({ data: { properties: { action_link: 'javascript:alert(1)' } } })).toBeNull();
  });
});

describe('buildAuthRedirect', () => {
  it('strips a hash route so supabase-js can read the session fragment', () => {
    // "…#/admin#access_token=…" is unparseable by the SDK and drops the session.
    expect(buildAuthRedirect('https://roryskagenart.com/#/admin')).toBe('https://roryskagenart.com/');
  });

  it('normalizes a bare origin and a trailing slash', () => {
    expect(buildAuthRedirect('https://roryskagenart.com')).toBe('https://roryskagenart.com/');
    expect(buildAuthRedirect('https://roryskagenart.com/')).toBe('https://roryskagenart.com/');
    expect(buildAuthRedirect('http://localhost:3000/#/admin/catalog')).toBe('http://localhost:3000/');
  });
});
