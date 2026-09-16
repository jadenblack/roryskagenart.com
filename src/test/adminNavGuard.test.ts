/**
 * Asserts that the studio navigation and the server's own guards agree.
 *
 * WHY THIS EXISTS
 * `AGENTS.md` §8 states the rule as law: *"a `minRole` on a nav item must match the server guard
 * on the matching API route"*. The defect it describes is real and shipped once — v2.11.0 fixed
 * a Viewer being offered Inquiries and Media menu items that answered 403. Nothing in the suite
 * caught that, because the nav is data in a component and the guards are calls in a route file,
 * and no test looked at both.
 *
 * WHAT IT CHECKS
 *   1. Every `ADMIN_NAV` entry has a matching `case` in `AdminApp`'s router — a nav item with no
 *      case renders "Unknown admin page".
 *   2. The relationship runs both ways: a `minRole` item must render a `Forbidden` panel, and an
 *      item *without* one must not. That is the exact shape of the v2.11.0 bug in one direction,
 *      and of a viewer losing a screen they are allowed to read in the other.
 *   3. The v3.1.0 rows are pinned against the actual guards in `server/routes/plan.ts`, so moving
 *      the API's access level without moving the nav fails the suite.
 *
 * No network, no tokens: it reads source files, like `bundleSafety.test.ts`.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const read = (relative: string) => readFileSync(path.join(ROOT, relative), 'utf8');

const LAYOUT = 'src/components/admin/AdminLayout.tsx';
const APP = 'src/components/admin/AdminApp.tsx';
const PLAN_ROUTE = 'server/routes/plan.ts';

interface NavRow {
  route: string;
  label: string;
  minRole: string | null;
}

function navRows(): NavRow[] {
  const block = /export const ADMIN_NAV: AdminNavItem\[\] = \[([\s\S]*?)\n\];/.exec(read(LAYOUT));
  if (!block) throw new Error(`ADMIN_NAV could not be located in ${LAYOUT} — this guard is blind.`);

  return [...block[1].matchAll(/\{\s*route:\s*'([^']+)',\s*label:\s*'([^']+)'([^}]*)\}/g)].map(
    (match) => {
      const minRole = /minRole:\s*'([^']+)'/.exec(match[3]);
      return { route: match[1], label: match[2], minRole: minRole ? minRole[1] : null };
    }
  );
}

/** The body of each `case '<subPath>':` in `AdminApp`'s `renderView` switch. */
function routeCases(): Map<string, string> {
  const code = read(APP);
  const start = code.indexOf('switch (subPath)');
  const end = code.indexOf('const artworkForEdit');
  if (start < 0 || end < 0) {
    throw new Error(`the renderView switch could not be located in ${APP} — this guard is blind.`);
  }
  const body = code.slice(start, end);
  const marks = [...body.matchAll(/\n\s+case '([^']*)':/g)];

  const cases = new Map<string, string>();
  marks.forEach((mark, index) => {
    const from = mark.index + mark[0].length;
    const to = index + 1 < marks.length ? marks[index + 1].index : body.length;
    cases.set(mark[1], body.slice(from, to));
  });
  return cases;
}

const subPathOf = (route: string) => route.replace(/^\/admin\/?/, '');

describe('the nav reader', () => {
  it('finds the rows it is supposed to police', () => {
    // A guard that silently parses nothing would pass every assertion below.
    const rows = navRows();
    expect(rows.length).toBeGreaterThanOrEqual(10);
    expect(rows.map((r) => r.route)).toContain('/admin/planning');
    expect(rows.map((r) => r.route)).toContain('/admin/changelog');
  });

  it('finds the route cases it is supposed to compare them with', () => {
    const cases = routeCases();
    expect(cases.size).toBeGreaterThanOrEqual(10);
    expect(cases.has('planning')).toBe(true);
    expect(cases.has('changelog')).toBe(true);
  });
});

describe('nav ↔ route parity', () => {
  it('gives every nav item a route case', () => {
    const cases = routeCases();
    for (const row of navRows()) {
      expect(cases.has(subPathOf(row.route)), `${row.label} (${row.route}) has no case`).toBe(true);
    }
  });

  it('has no duplicate routes', () => {
    const routes = navRows().map((row) => row.route);
    expect(new Set(routes).size).toBe(routes.length);
  });

  /**
   * Both directions of the rule, and both are defects:
   *   * a `minRole` item with no `Forbidden` panel means the screen itself does not enforce what
   *     the nav promises, so a viewer reaching it by URL sees a broken page;
   *   * an item *without* a `minRole` that renders `Forbidden` means the nav advertises a screen
   *     the route refuses — the v2.11.0 bug, one level up.
   */
  it('renders a Forbidden panel exactly where the nav declares a minRole', () => {
    const cases = routeCases();
    for (const row of navRows()) {
      const block = cases.get(subPathOf(row.route));
      if (block === undefined) continue; // reported by the previous test

      if (row.minRole) {
        expect(block, `${row.route} declares minRole ${row.minRole} but renders no Forbidden panel`)
          .toContain('Forbidden');
      } else {
        expect(block, `${row.route} has no minRole and must not be gated`).not.toContain('Forbidden');
      }
    }
  });

  it('gates an admin item on the admin role, not merely on canEdit', () => {
    const cases = routeCases();
    for (const row of navRows()) {
      if (row.minRole !== 'admin') continue;
      const block = cases.get(subPathOf(row.route)) ?? '';
      expect(block, `${row.route} must check role === 'admin'`).toContain("role === 'admin'");
    }
  });
});

describe('the v3.1.0 rows, pinned to the server', () => {
  const planRoute = () => read(PLAN_ROUTE).replace(/\s+/g, ' ');

  it('offers Changelog to every role, because its endpoint needs only a session', () => {
    const changelog = navRows().find((row) => row.route === '/admin/changelog');
    expect(changelog, 'the Changelog nav item is missing').toBeTruthy();
    expect(changelog!.minRole).toBeNull();

    // The server half: requireAuth and no role check.
    expect(planRoute()).toMatch(/planRouter\.get\("\/history", requireAuth,/);
    expect(planRoute()).not.toMatch(/planRouter\.get\("\/history", requireAuth, requireRole/);
  });

  it('restricts Planning to editor+, matching requireRole("editor") on every board route', () => {
    const planning = navRows().find((row) => row.route === '/admin/planning');
    expect(planning, 'the Planning nav item is missing').toBeTruthy();
    expect(planning!.minRole).toBe('editor');

    const code = planRoute();
    for (const route of [
      'planRouter.get("/items", requireAuth, requireRole("editor")',
      'planRouter.patch("/items/:id", requireAuth, requireRole("editor")',
      'planRouter.delete("/items/:id", requireAuth, requireRole("editor")',
    ]) {
      expect(code, `${route} must stay editor-gated`).toContain(route);
    }
  });

  it('keeps the public feedback door public, and guarded by the shared abuse controls', () => {
    const code = planRoute();
    // No requireAuth and no requireRole on this one — a visitor with no account must reach it.
    expect(code).toMatch(/planRouter\.post\( "\/feedback", honeypotGate\(\), rateLimit\(/);
    expect(code).not.toMatch(/planRouter\.post\( "\/feedback", requireAuth/);
  });
});
