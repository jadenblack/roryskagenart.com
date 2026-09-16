/**
 * Pins the release-history parser against the shapes the real documents actually have.
 *
 * WHY THESE FIXTURES LOOK THE WAY THEY DO
 * Every case below was taken from `CHANGELOG.md` or `DEPLOYMENT_LOG.md` as they exist today, not
 * invented. Those two files are hand-maintained by the release process, so they are irregular by
 * nature: headings carry parenthetical and em-dash suffixes, retired rows are struck through, the
 * newest section has no version, and a release body contains markdown tables and fenced SQL. The
 * parser has to survive all of it, and the failure mode that matters is not a crash — it is
 * *quietly attributing content to the wrong release*, which a reader would never notice.
 *
 * Offline: no filesystem, no database, no network.
 */
import { describe, expect, it } from 'vitest';
import {
  buildReleaseLog,
  flatten,
  parseChangelog,
  parseDeploymentLog,
} from '../../scripts/lib/releaseLog';

const CHANGELOG_FIXTURE = `# Changelog

Some preamble that is not a release.

---

## [Unreleased]

> **Accumulating for the next one.** A preamble that
> wraps across two lines.

### Added

- **A new thing.** It does something, and the
  description continues on the next line.
  - A nested detail.
  - Another nested detail.
- A second top-level entry.

### Fixed

- A bug.

## [2.17.0] - 2026-09-15

### Added — A suffix after an em dash

- Entry under a suffixed heading.

### Fixed (v2.14.0 follow-ups)

- Entry under a parenthesised heading.

## [2.16.0] - 2026-09-15

### Docs

- Documentation-only entry.

## [2.15.0]

### Added

- This release has no date in its heading.
`;

describe('parseChangelog', () => {
  const { releases, warnings } = parseChangelog(CHANGELOG_FIXTURE);

  it('finds every release, including the unreleased block', () => {
    expect(releases.map((r) => r.version)).toEqual([null, '2.17.0', '2.16.0', '2.15.0']);
    expect(releases[0].unreleased).toBe(true);
    expect(releases.slice(1).every((r) => !r.unreleased)).toBe(true);
  });

  it('reads the date off the heading and leaves it null when absent', () => {
    expect(releases[1].date).toBe('2026-09-15');
    expect(releases[3].date).toBeNull();
    // A missing date is reported, not silently accepted.
    expect(warnings.some((w) => w.includes('2.15.0') && w.includes('no date'))).toBe(true);
  });

  it('joins a multi-line blockquote preamble and drops the rule lines', () => {
    expect(releases[0].summary).toBe(
      'Accumulating for the next one. A preamble that wraps across two lines.'
    );
  });

  it('leaves summary null when a release carries no preamble', () => {
    expect(releases[1].summary).toBeNull();
  });

  it('classifies a plain heading, an em-dash suffix and a parenthesised suffix alike', () => {
    expect(releases[1].sections.map((s) => s.category)).toEqual(['Added', 'Fixed']);
    // The heading text is preserved verbatim even though the category is normalised.
    expect(releases[1].sections[0].heading).toBe('Added — A suffix after an em dash');
    expect(releases[1].sections[1].heading).toBe('Fixed (v2.14.0 follow-ups)');
  });

  it('recognises a repo-specific section as Notes rather than reporting drift', () => {
    expect(releases[2].sections[0].category).toBe('Notes');
    expect(warnings.some((w) => w.includes('Docs'))).toBe(false);
  });

  it('attaches an indented continuation to its parent entry, not to a new one', () => {
    const entries = releases[0].sections[0].entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].text).toContain('It does something, and the description continues on the next line.');
    expect(entries[0].details).toEqual(['A nested detail.', 'Another nested detail.']);
    expect(entries[1].text).toBe('A second top-level entry.');
  });

  it('keeps the original markdown alongside the flattened text', () => {
    const entry = releases[0].sections[0].entries[0];
    expect(entry.raw).toContain('**A new thing.**');
    expect(entry.text).not.toContain('**');
  });

  it('never throws on input that is not a changelog at all', () => {
    for (const input of ['', 'not a changelog', '# Just a title', '| a | b |\n| - | - |']) {
      expect(() => parseChangelog(input)).not.toThrow();
    }
    expect(parseChangelog('').releases).toEqual([]);
    expect(parseChangelog('').warnings.some((w) => w.includes('No releases found'))).toBe(true);
  });

  it('does not attribute the body of an unrecognised ## heading to the release above it', () => {
    // This is the failure that matters: silently merging two releases into one.
    const md = `## [1.0.0] - 2026-01-01

### Added

- Real entry.

## Deployment notes

### Added

- This bullet belongs to no release and must not join 1.0.0.
`;
    const result = parseChangelog(md);
    expect(result.releases).toHaveLength(1);
    expect(result.releases[0].sections[0].entries).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('Deployment notes'))).toBe(true);
  });

  it('ignores fenced code blocks and markdown tables inside a release', () => {
    const md = `## [1.0.0] - 2026-01-01

### Added

- A real entry.

\`\`\`sql
CREATE TABLE x (id int);
- not a bullet
\`\`\`

  | table | before | after |
  | :--- | ---: | ---: |
  | artworks | 138 | 205 |
`;
    const result = parseChangelog(md);
    const entries = result.releases[0].sections[0].entries;
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('A real entry.');
    expect(entries[0].text).not.toContain('not a bullet');
    expect(entries[0].text).not.toContain('artworks');
  });

  it('gives a bullet that appears before any section a home, and says so', () => {
    const md = `## [1.0.0] - 2026-01-01

- Orphan bullet.

### Added

- Normal bullet.
`;
    const result = parseChangelog(md);
    expect(result.releases[0].sections[0].heading).toBe('(no section)');
    expect(result.releases[0].sections[0].entries[0].text).toBe('Orphan bullet.');
    expect(result.warnings.some((w) => w.includes('before any section'))).toBe(true);
  });
});

const DEPLOYMENT_FIXTURE = `# Deployment Log

Intro prose that is not a table.

| Date (UTC) | Version | Deployment URL | Status | Build Time | Target | Associated Commits / Milestone |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-09-15** | **v3.0.0** | [\`roryskagen-abc.vercel.app\`](https://roryskagen-abc.vercel.app) | \`● Ready\` | n/a | Production | \`dc4be84\`: PR #32 — the load |
| 2026-09-15 | v2.17.0-stack ⚠️ | [\`roryskagen-def.vercel.app\`](https://roryskagen-def.vercel.app) | \`● Ready\` | 29s | Preview | \`d23feb0\`: merged in a burst |

---

## Key Milestones

1. A numbered list that must not be read as a deployment.

| Some | Other | Table |
| :--- | :--- | :--- |
| not | a | deployment |
`;

describe('parseDeploymentLog', () => {
  const { rows, warnings } = parseDeploymentLog(DEPLOYMENT_FIXTURE);

  it('reads only the table whose header names a date and a version', () => {
    expect(rows).toHaveLength(2);
    expect(warnings).toEqual([]);
  });

  it('extracts the href rather than the link text', () => {
    expect(rows[0].url).toBe('https://roryskagen-abc.vercel.app');
  });

  it('parses every column, flattening the markdown', () => {
    expect(rows[0]).toMatchObject({
      date: '2026-09-15',
      version: 'v3.0.0',
      status: '● Ready',
      buildTime: 'n/a',
      target: 'Production',
    });
    expect(rows[0].commits).toContain('PR #32 — the load');
  });

  it('flags a row that carries the warning marker', () => {
    expect(rows[0].flagged).toBe(false);
    expect(rows[1].flagged).toBe(true);
  });

  it('does not mistake a later unrelated table for the deployment history', () => {
    expect(rows.every((r) => r.target === 'Production' || r.target === 'Preview')).toBe(true);
  });

  it('reports rather than throws when no table is present', () => {
    expect(parseDeploymentLog('# Nothing here').rows).toEqual([]);
    expect(parseDeploymentLog('# Nothing here').warnings.some((w) => w.includes('No deployment rows'))).toBe(true);
    expect(() => parseDeploymentLog('')).not.toThrow();
  });
});

describe('flatten', () => {
  it('reduces a link to its text before stripping emphasis', () => {
    // Order matters: stripping ** first would leave a bare `](url)` behind.
    expect(flatten('[**bold link**](https://example.com)')).toBe('bold link');
  });

  it('unwraps code spans, bold, italics and strikethrough', () => {
    expect(flatten('a `code` **bold** *it* ~~gone~~ b')).toBe('a code bold it gone b');
  });

  it('collapses whitespace so multi-line entries read as one sentence', () => {
    expect(flatten('one\n  two   three')).toBe('one two three');
  });
});

describe('buildReleaseLog', () => {
  it('returns both halves plus diagnostics, and never throws on empty input', () => {
    const log = buildReleaseLog('', '');
    expect(log.changelog).toEqual([]);
    expect(log.deployments).toEqual([]);
    expect(log.diagnostics.releases).toBe(0);
    expect(log.diagnostics.deploymentRows).toBe(0);
    expect(log.diagnostics.warnings.length).toBeGreaterThan(0);
  });

  it('reports counts that match the parsed structure', () => {
    const log = buildReleaseLog(CHANGELOG_FIXTURE, DEPLOYMENT_FIXTURE);
    expect(log.diagnostics.releases).toBe(log.changelog.length);
    expect(log.diagnostics.deploymentRows).toBe(log.deployments.length);
  });
});
