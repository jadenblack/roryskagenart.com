/**
 * The staleness guard for `src/data/releaseLog.generated.ts`.
 *
 * WHY THIS IS A TEST AND NOT A CONVENTION
 * The admin Changelog screen does not read `CHANGELOG.md` at runtime — it serves a committed
 * artifact (see `scripts/generate-release-log.ts` for why). That buys testability and costs one
 * new failure mode: the artifact can go stale, and a stale history screen is worse than no screen,
 * because the studio would read a changelog that is not the changelog and have no way to tell.
 *
 * This is the same defect `src/data/assetRegistry.ts` has (R-20's neighbourhood), and the answer
 * is the same one `scripts/prerender-seo.ts` uses for an empty sitemap: make the bad state
 * impossible to ship rather than documented. This test regenerates the structure in memory from
 * the two documents and asserts it equals the checked-in file. Forgetting to regenerate therefore
 * **fails the suite**, which is the merge gate.
 *
 * ⚠️ LINE ENDINGS. `core.autocrlf=true` is set on the primary development machine and
 * `.gitattributes` pins only `*.sql`, so the artifact may be read back with CRLF while the
 * regenerated text is LF. Both sides are normalised before comparison — otherwise this test would
 * fail on one machine and pass on another, which is the least useful kind of failure. It is
 * deliberately not "fixed" by rewriting line endings anywhere.
 *
 * Offline: reads files, opens no connection.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { buildReleaseLog } from '../../scripts/lib/releaseLog';
import { renderArtifact } from '../../scripts/generate-release-log';

const ROOT = path.resolve(__dirname, '../..');
const CHANGELOG = 'CHANGELOG.md';
const DEPLOYMENT_LOG = 'DEPLOYMENT_LOG.md';
const ARTIFACT = 'src/data/releaseLog.generated.ts';

/** CRLF-insensitive comparison, so the guard tests content rather than checkout settings. */
function normalise(text: string): string {
  return text.replace(/\r\n/g, '\n').trimEnd();
}

describe('releaseLog artifact is in sync with its sources', () => {
  it('equals a fresh parse of CHANGELOG.md and DEPLOYMENT_LOG.md', () => {
    const log = buildReleaseLog(
      fs.readFileSync(path.join(ROOT, CHANGELOG), 'utf8'),
      fs.readFileSync(path.join(ROOT, DEPLOYMENT_LOG), 'utf8')
    );
    const expected = normalise(renderArtifact(log));
    const actual = normalise(fs.readFileSync(path.join(ROOT, ARTIFACT), 'utf8'));

    expect(
      actual,
      `${ARTIFACT} is stale. Run: npx tsx scripts/generate-release-log.ts`
    ).toBe(expected);
  });

  it('parsed both documents for real — a guard that cannot fail is decoration', () => {
    // Without this, an empty artifact and an empty parse would agree, and the sync test above
    // would pass while the screen showed nothing.
    const log = buildReleaseLog(
      fs.readFileSync(path.join(ROOT, CHANGELOG), 'utf8'),
      fs.readFileSync(path.join(ROOT, DEPLOYMENT_LOG), 'utf8')
    );
    expect(log.diagnostics.releases).toBeGreaterThan(10);
    expect(log.diagnostics.deploymentRows).toBeGreaterThan(10);
    expect(log.diagnostics.warnings).toEqual([]);
  });

  it('is deterministic — regenerating twice produces identical bytes', () => {
    // The release checklist's check is `generate-release-log.ts && git diff --exit-code`, which a
    // timestamp would break on every run and train everyone to ignore.
    const read = () => ({
      changelog: fs.readFileSync(path.join(ROOT, CHANGELOG), 'utf8'),
      deployment: fs.readFileSync(path.join(ROOT, DEPLOYMENT_LOG), 'utf8'),
    });
    const { changelog, deployment } = read();
    const once = renderArtifact(buildReleaseLog(changelog, deployment));
    const twice = renderArtifact(buildReleaseLog(changelog, deployment));
    expect(once).toBe(twice);

    // Assert the *structure* has no volatile field, rather than grepping the emitted text: the
    // changelog legitimately contains the word "timestamp" (v2.17.0's no-op proof), so a regex
    // over the whole document reports a false positive.
    const payload = JSON.parse(/RELEASE_LOG: ReleaseLog = ([\s\S]*);\s*$/.exec(once)![1]);
    expect(Object.keys(payload).sort()).toEqual(['changelog', 'deployments', 'diagnostics']);
    expect(Object.keys(payload.diagnostics).sort()).toEqual([
      'deploymentRows',
      'releases',
      'warnings',
    ]);
  });
});
