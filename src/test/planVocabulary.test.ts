import { describe, it, expect } from 'vitest';
import { normalizeVersion } from '../lib/planVocabulary';
import type { ReleaseLog } from '../data/releaseLog.generated';

/**
 * The version join between the plan and the history.
 *
 * `v3.2.0` task 7 cross-links a release row to the CHANGELOG block that documents it. The join
 * is on `version`, and the two sides are punctuated differently with nothing enforcing
 * agreement — so the join either works or silently reports every release as undocumented.
 * These tests exist because that failure looks exactly like the truth.
 */
describe('normalizeVersion', () => {
  it('strips the leading v the studio types but the changelog does not carry', () => {
    expect(normalizeVersion('v3.2.0')).toBe('3.2.0');
    expect(normalizeVersion('V3.2.0')).toBe('3.2.0');
    expect(normalizeVersion('3.2.0')).toBe('3.2.0');
  });

  it('trims and lowercases, so a typed label still meets its block', () => {
    expect(normalizeVersion('  v3.2.0  ')).toBe('3.2.0');
    expect(normalizeVersion('V3.10.0')).toBe('3.10.0');
  });

  it('returns empty for null, undefined and empty — never "undefined"', () => {
    expect(normalizeVersion(null)).toBe('');
    expect(normalizeVersion(undefined)).toBe('');
    expect(normalizeVersion('')).toBe('');
  });

  it('leaves a non-version label alone rather than guessing', () => {
    // `backlog` was a real `target_release` value. It matches no changelog block, and the
    // dialog says so — which is the honest answer. Padding or parsing it would be a guess.
    expect(normalizeVersion('backlog')).toBe('backlog');
    expect(normalizeVersion('v')).toBe('');
  });

  it('joins a real release to a real changelog block', () => {
    // The shape the dialog builds: changelog keyed by normalised version.
    const changelog: Pick<ReleaseLog['changelog'][number], 'version'>[] = [
      { version: '3.1.0' },
      { version: '3.0.0' },
      { version: null },
    ];
    const byVersion = new Map(
      changelog.filter((entry) => entry.version).map((entry) => [normalizeVersion(entry.version), entry]),
    );

    expect(byVersion.get(normalizeVersion('v3.1.0'))).toBeDefined();
    expect(byVersion.get(normalizeVersion('v3.2.0'))).toBeUndefined();
  });

  it('does not reorder versions — the sort hazard it sits next to', () => {
    // A text sort is not semver: '3.10.0' < '3.2.0'. normalizeVersion deliberately does not
    // "fix" this, because the releases list orders by lifecycle then created_at instead.
    expect(normalizeVersion('v3.10.0') < normalizeVersion('v3.2.0')).toBe(true);
  });
});
