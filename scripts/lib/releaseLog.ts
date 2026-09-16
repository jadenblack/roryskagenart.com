/**
 * Pure parser for the project's two release-history documents.
 *
 * WHY THIS IS A SEPARATE MODULE
 * The admin "Changelog" screen (v3.1.0, capability C1) must display what actually shipped. There
 * are two sources, and neither is a database table: `CHANGELOG.md` is the forward-written record
 * of what changed, and `DEPLOYMENT_LOG.md` is the record of what was deployed where. They are
 * owned by the *release process*, not by the studio, so the studio must not be able to edit them
 * (see D1 in plan/ROADMAP_V3_1_TO_V3_3_FEEDBACK_AND_PLANNING.md — history is derived, the plan is
 * authored, and the two are never merged).
 *
 * Parsing markdown is exactly the kind of decision that is unreachable to a test when it lives
 * inside a script that also reads the filesystem and talks to Supabase. `scripts/lib/seoPlan.ts`
 * states the repo's rule: *"a decision made inside a script that talks to Supabase is a decision
 * no test can reach."* So the parse lives here, takes a **string**, returns a **typed structure**,
 * imports nothing, and is pinned by `src/test/releaseLog.test.ts`.
 *
 * CONTRACT: these functions never throw on malformed input. A document that has drifted is a
 * normal condition — `CHANGELOG.md` already carries struck-through retired rows, parenthetical
 * section suffixes and an `[Unreleased]` section — so the parser returns whatever it could read
 * plus a `warnings` list. A history screen that renders 90% of the changelog and says so beats one
 * that returns a stack trace.
 */

/** The Keep a Changelog 1.1.0 categories, plus `Notes` for the repo's own non-standard sections. */
export type ChangelogCategory =
  | 'Added'
  | 'Changed'
  | 'Deprecated'
  | 'Removed'
  | 'Fixed'
  | 'Security'
  | 'Notes';

/** Recognised headings, lower-cased for matching. */
const CATEGORIES: readonly ChangelogCategory[] = [
  'Added',
  'Changed',
  'Deprecated',
  'Removed',
  'Fixed',
  'Security',
  'Notes',
];

/**
 * Sections this repo writes that are not Keep a Changelog categories. They are *recognised* (so
 * they are not reported as drift) but deliberately map to `Notes`, because promoting them to a
 * real category would let a release claim "Added" for something that was only verified.
 */
const NON_CATEGORY_SECTIONS: readonly string[] = [
  'Verified',
  'Validation',
  'Documentation',
  'Docs',
  'Dependencies',
  'Deployment',
  'Findings recorded',
  'Completed',
  'Chore',
  'Notes',
];

/** One bullet in a changelog section. */
export interface ChangelogEntry {
  /** Display-ready: emphasis flattened, links reduced to their text. */
  text: string;
  /** Nested sub-bullets, one flattened string each. */
  details: string[];
  /** The original markdown, so a view can render it faithfully if it wants to. */
  raw: string;
}

/** One `### Heading` inside a release. */
export interface ChangelogSection {
  /** The heading as written, e.g. `Added — Scripted Restore & Connection-Target Safety`. */
  heading: string;
  /** The matched Keep a Changelog category, or `Notes` for a recognised non-category section. */
  category: ChangelogCategory;
  entries: ChangelogEntry[];
}

/** One `## [version] - date` block, or the `[Unreleased]` block. */
export interface ChangelogRelease {
  /** `3.0.0`, or `null` for the unreleased block. */
  version: string | null;
  /** ISO `YYYY-MM-DD` from the heading, or `null` when the heading carries none. */
  date: string | null;
  /** The blockquote preamble, flattened. `null` when the release carries none. */
  summary: string | null;
  sections: ChangelogSection[];
  /** True for the `[Unreleased]` block, which has no version and no date. */
  unreleased: boolean;
}

/** One row of `DEPLOYMENT_LOG.md`'s deployment table. */
export interface DeploymentRow {
  date: string | null;
  version: string | null;
  url: string | null;
  /** e.g. `● Ready`, `● Error`. */
  status: string | null;
  /** e.g. `n/a`, `29s`. */
  buildTime: string | null;
  /** `Production` or `Preview`. */
  target: string | null;
  /** The commit SHAs, PR numbers and description, flattened. */
  commits: string | null;
  /** True when the row carries the ⚠️ marker the log uses for process problems. */
  flagged: boolean;
}

/** What the parser could not make sense of. Rendered by the view; never swallowed. */
export interface ReleaseLogDiagnostics {
  releases: number;
  deploymentRows: number;
  warnings: string[];
}

/** The full derived history. This is what `GET /api/plan/history` returns. */
export interface ReleaseLog {
  changelog: ChangelogRelease[];
  deployments: DeploymentRow[];
  diagnostics: ReleaseLogDiagnostics;
}

/**
 * Flatten markdown emphasis for display.
 *
 * Deliberately minimal and order-sensitive: links are reduced to their text *before* the emphasis
 * markers are stripped, so `[**x**](url)` does not lose the link text. Code spans are unwrapped
 * rather than kept, because this output feeds plain text, not a renderer.
 */
export function flatten(markdown: string): string {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) -> text
    .replace(/\*\*([^*]*)\*\*/g, '$1') // **bold** -> bold
    .replace(/__([^_]*)__/g, '$1') // __bold__ -> bold
    .replace(/(^|\s)\*([^*\s][^*]*)\*/g, '$1$2') // *italic* -> italic
    .replace(/~~([^~]*)~~/g, '$1') // ~~struck~~ -> struck
    .replace(/`([^`]*)`/g, '$1') // `code` -> code
    .replace(/\s+/g, ' ')
    .trim();
}

/** True for a line that opens or closes a fenced code block. */
function isFence(line: string): boolean {
  return /^\s*(```|~~~)/.test(line);
}

/**
 * Pull the category out of a `###` heading.
 *
 * Headings in this repo are irregular by design — `### Fixed (v2.14.0 follow-ups)`,
 * `### Added — Scripted Restore & Connection-Target Safety`, `### Chore — Repository Hygiene`.
 * The category is therefore the leading token, matched case-insensitively, and the rest of the
 * heading is kept verbatim in `heading`.
 */
function classifyHeading(heading: string): ChangelogCategory | null {
  const leading = heading.split(/\s+[—–-]\s+|\s*\(/)[0].trim().toLowerCase();
  const exact = CATEGORIES.find((c) => c.toLowerCase() === leading);
  if (exact) return exact;
  const known = NON_CATEGORY_SECTIONS.find((c) => c.toLowerCase() === leading);
  if (known) return 'Notes';
  return null;
}

/**
 * Parse `CHANGELOG.md`.
 *
 * Recognises `## [x.y.z] - YYYY-MM-DD` and `## [Unreleased]`, then `### Heading` sections and
 * their `- ` bullets with indented continuations and sub-bullets. Tables, fences, rules and
 * horizontal whitespace inside a release are ignored rather than misread as entries.
 */
export function parseChangelog(markdown: string): {
  releases: ChangelogRelease[];
  warnings: string[];
} {
  const releases: ChangelogRelease[] = [];
  const warnings: string[] = [];

  let current: ChangelogRelease | null = null;
  let section: ChangelogSection | null = null;
  let entry: ChangelogEntry | null = null;
  let summaryParts: string[] = [];
  let inFence = false;

  const closeRelease = () => {
    if (!current) return;
    const summary = flatten(summaryParts.join(' '));
    current.summary = summary.length ? summary : null;
    releases.push(current);
    current = null;
    section = null;
    entry = null;
    summaryParts = [];
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    if (isFence(rawLine)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) continue;

    // ---- `## ` — a release boundary ------------------------------------------------
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      closeRelease();
      const heading = h2[1].trim();
      const bracketed = /^\[([^\]]+)\](?:\s*[-—]\s*(\d{4}-\d{2}-\d{2}))?/.exec(heading);
      if (!bracketed) {
        // A `## ` heading that is not a release. Record it and drop the body, so its content is
        // never attributed to the release above it.
        warnings.push(`Unrecognised release heading, its body was skipped: "${heading}"`);
        continue;
      }
      const label = bracketed[1].trim();
      const unreleased = /^unreleased$/i.test(label);
      current = {
        version: unreleased ? null : label,
        date: bracketed[2] ?? null,
        summary: null,
        sections: [],
        unreleased,
      };
      if (!unreleased && !bracketed[2]) {
        warnings.push(`Release ${label} has no date in its heading.`);
      }
      continue;
    }

    // Everything below needs a release to attach to.
    if (!current) continue;

    // ---- `### ` — a section --------------------------------------------------------
    const h3 = /^###\s+(.*)$/.exec(line);
    if (h3) {
      const heading = h3[1].trim();
      const category = classifyHeading(heading);
      if (!category) {
        warnings.push(`Unrecognised section heading in ${current.version ?? 'Unreleased'}: "${heading}"`);
      }
      section = { heading, category: category ?? 'Notes', entries: [] };
      current.sections.push(section);
      entry = null;
      continue;
    }

    // ---- `> ` — the release preamble -----------------------------------------------
    if (/^>\s?/.test(line)) {
      const text = line.replace(/^>\s?/, '').trim();
      if (text && !/^-{3,}$/.test(text)) summaryParts.push(text);
      continue;
    }

    if (/^-{3,}$/.test(line.trim())) continue; // horizontal rule

    // ---- bullets -------------------------------------------------------------------
    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      const indent = bullet[1].length;
      const text = bullet[2].trim();
      if (indent === 0) {
        entry = { text: flatten(text), details: [], raw: text };
        // A bullet with no section above it still belongs to the release; give it a home rather
        // than dropping it silently.
        if (!section) {
          section = { heading: '(no section)', category: 'Notes', entries: [] };
          current.sections.push(section);
          warnings.push(`Bullet before any section heading in ${current.version ?? 'Unreleased'}.`);
        }
        section.entries.push(entry);
      } else if (entry) {
        entry.details.push(flatten(text));
        entry.raw += `\n${line}`;
      } else {
        // An indented bullet with no parent — treat it as a top-level entry.
        entry = { text: flatten(text), details: [], raw: text };
        if (!section) {
          section = { heading: '(no section)', category: 'Notes', entries: [] };
          current.sections.push(section);
        }
        section.entries.push(entry);
      }
      continue;
    }

    // ---- indented continuation of the current entry --------------------------------
    if (entry && /^\s+/.test(line) && !line.trim().startsWith('|')) {
      entry.text = flatten(`${entry.text} ${line.trim()}`);
      entry.raw += `\n${line}`;
      continue;
    }

    // ---- a numbered list item, a table row, or loose prose -------------------------
    if (entry && /^\s*\d+\.\s+/.test(line)) {
      entry.details.push(flatten(line.trim().replace(/^\d+\.\s+/, '')));
      continue;
    }
    // Anything else (tables, stray prose) is not a changelog entry. Ignore it rather than
    // inventing one — the summary of a release is its bullets, not its prose.
  }

  closeRelease();

  if (releases.length === 0) {
    warnings.push('No releases found — the changelog heading format may have changed.');
  }

  return { releases, warnings };
}

/** Split a markdown table row into trimmed cells, dropping the empty leading/trailing cells. */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const withoutTrailing = inner.endsWith('|') ? inner.slice(0, -1) : inner;
  return withoutTrailing.split('|').map((cell) => cell.trim());
}

/** True for a markdown table separator row such as `| :--- | ---: |`. */
function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s/g, '')));
}

/**
 * Parse the deployment table out of `DEPLOYMENT_LOG.md`.
 *
 * Only the rows of the *deployment history* table are read: the file also carries architecture
 * milestones, a "Maintaining this log" section and fenced shell examples, all of which must not be
 * mistaken for deployments. Rows are located by finding the header row that names the columns, so
 * a table that moves within the document keeps working.
 */
export function parseDeploymentLog(markdown: string): {
  rows: DeploymentRow[];
  warnings: string[];
} {
  const rows: DeploymentRow[] = [];
  const warnings: string[] = [];

  let inFence = false;
  let columns: string[] | null = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    if (isFence(rawLine)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim().startsWith('|')) {
      // A blank line or prose ends the table. Reset so a later table can be picked up on its own
      // header row, and so a non-deployment table is never read as one.
      columns = null;
      continue;
    }

    const cells = splitTableRow(line);

    if (!columns) {
      const header = cells.map((c) => flatten(c).toLowerCase());
      if (header.some((h) => h.startsWith('date')) && header.some((h) => h.includes('version'))) {
        columns = header;
      }
      continue;
    }

    if (isSeparatorRow(cells)) continue;

    const at = (name: string): string | null => {
      const index = columns!.findIndex((h) => h.includes(name));
      if (index < 0 || index >= cells.length) return null;
      const value = flatten(cells[index]);
      return value.length ? value : null;
    };

    const rawUrlCell = cells[columns.findIndex((h) => h.includes('url'))] ?? '';
    const linkMatch = /\]\((https?:\/\/[^)]+)\)/.exec(rawUrlCell);
    const versionCell = cells[columns.findIndex((h) => h.includes('version'))] ?? '';

    rows.push({
      date: at('date'),
      version: at('version'),
      url: linkMatch ? linkMatch[1] : null,
      status: at('status'),
      buildTime: at('build'),
      target: at('target'),
      commits: at('commit'),
      flagged: /⚠️/.test(`${versionCell} ${cells.join(' ')}`),
    });
  }

  if (rows.length === 0) {
    warnings.push('No deployment rows found — the table header may have changed.');
  }

  return { rows, warnings };
}

/**
 * Parse both documents into the structure the admin screen renders.
 *
 * `diagnostics.warnings` is part of the payload on purpose: when the documents change shape, the
 * screen says so instead of quietly showing less. A silent partial parse is the failure this
 * whole module exists to prevent.
 */
export function buildReleaseLog(changelogMarkdown: string, deploymentMarkdown: string): ReleaseLog {
  const changelog = parseChangelog(changelogMarkdown);
  const deployments = parseDeploymentLog(deploymentMarkdown);

  return {
    changelog: changelog.releases,
    deployments: deployments.rows,
    diagnostics: {
      releases: changelog.releases.length,
      deploymentRows: deployments.rows.length,
      warnings: [...changelog.warnings, ...deployments.warnings],
    },
  };
}
