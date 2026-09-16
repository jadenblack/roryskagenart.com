import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  buildListFilters,
  buildPlanItemInput,
  buildPlanItemPatch,
  isPlanKind,
  isPlanPriority,
  isPlanStatus,
  isStaffKind,
  isUuid,
  readPageUrl,
  PLAN_LIST_DEFAULT_LIMIT,
  PLAN_LIST_MAX_LIMIT,
} from '../../server/lib/planRules';
import {
  canTransitionStatus,
  nextStatuses,
  PLAN_LIMITS,
  STAFF_KINDS,
  STATUS_TRANSITIONS,
  type PlanStatus,
} from '../lib/planVocabulary';

const STUDIO = {
  door: 'studio' as const,
  author: { id: '11111111-1111-1111-1111-111111111111', email: 'Rory@RorySkagenArt.com', name: 'Rory Skagen' },
};

describe('buildPlanItemInput — the public door', () => {
  const PUBLIC = { door: 'public' as const };

  it('forces kind, source, status and the studio-only fields', () => {
    const result = buildPlanItemInput({ title: 'A dark mode would be lovely' }, PUBLIC);
    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      kind: 'suggestion',
      source: 'public',
      status: 'new',
      priority: null,
      target_release: null,
      source_ref: null,
      author_id: null,
      author_name: null,
      page_url: null,
    });
  });

  /**
   * The exit criterion of §4, and the one rule the whole design rests on: an anonymous
   * caller that claims to be staff is still anonymous.
   */
  it('ignores a body that claims to be staff', () => {
    const result = buildPlanItemInput(
      {
        title: 'Totally a staff item',
        source: 'studio',
        kind: 'bug',
        status: 'done',
        priority: 'high',
        target_release: 'v3.4.0',
        author_id: 'deadbeef-dead-beef-dead-beefdeadbeef',
        author_email: 'rory@roryskagenart.com',
        author_name: 'Rory Skagen',
        source_ref: 'artwork:the-balloon-cats-ii',
      },
      PUBLIC
    );
    expect(result.value).toMatchObject({
      kind: 'suggestion',
      source: 'public',
      status: 'new',
      priority: null,
      target_release: null,
      source_ref: null,
      author_id: null,
      author_name: null,
    });
  });

  it('never attributes an item to a session, even when one is supplied', () => {
    const result = buildPlanItemInput({ title: 'Feedback' }, { door: 'public', author: STUDIO.author });
    expect(result.value.author_id).toBeNull();
    expect(result.value.author_email).toBeNull();
  });

  it('accepts an optional email and normalises it', () => {
    const result = buildPlanItemInput({ title: 'Feedback', email: '  Curator@Example.COM ' }, PUBLIC);
    expect(result.value.author_email).toBe('curator@example.com');
  });

  it('treats an absent or blank email as no email at all', () => {
    for (const email of [undefined, null, '', '   ']) {
      expect(buildPlanItemInput({ title: 'Feedback', email }, PUBLIC).value.author_email).toBeNull();
    }
  });

  it('refuses an email that is present but malformed, rather than dropping it', () => {
    const result = buildPlanItemInput({ title: 'Feedback', email: 'nope' }, PUBLIC);
    expect(result.error).toMatch(/email/i);
  });

  it('stores an http(s) page_url and drops anything else without failing', () => {
    expect(
      buildPlanItemInput({ title: 't', page_url: 'https://roryskagenart.com/#/catalog' }, PUBLIC).value.page_url
    ).toBe('https://roryskagenart.com/#/catalog');

    for (const page_url of ['javascript:alert(1)', 'not a url', '', '   ', 42, null, undefined]) {
      const result = buildPlanItemInput({ title: 't', page_url }, PUBLIC);
      expect(result.error).toBeUndefined();
      expect(result.value.page_url).toBeNull();
    }
  });

  it('prefers the page_url in the body and falls back to the route-supplied referer', () => {
    const fromBody = buildPlanItemInput(
      { title: 't', page_url: 'https://roryskagenart.com/#/catalog' },
      { door: 'public', pageUrl: 'https://roryskagenart.com/#/contact' }
    );
    expect(fromBody.value.page_url).toBe('https://roryskagenart.com/#/catalog');

    const fromContext = buildPlanItemInput(
      { title: 't' },
      { door: 'public', pageUrl: 'https://roryskagenart.com/#/contact' }
    );
    expect(fromContext.value.page_url).toBe('https://roryskagenart.com/#/contact');
  });

  it('caps the page_url length and strips control characters', () => {
    const long = `https://example.com/${'a'.repeat(PLAN_LIMITS.pageUrl)}`;
    expect(buildPlanItemInput({ title: 't', page_url: long }, PUBLIC).value.page_url).toBeNull();

    const withNewline = buildPlanItemInput(
      { title: 't', page_url: 'https://example.com/a\nb' },
      PUBLIC
    );
    expect(withNewline.value.page_url).toBe('https://example.com/ab');
  });
});

describe('buildPlanItemInput — shared field rules', () => {
  const PUBLIC = { door: 'public' as const };

  it('requires a title', () => {
    for (const title of [undefined, null, '', '   ', 42, {}]) {
      const result = buildPlanItemInput({ title }, PUBLIC);
      expect(result.error).toBeTruthy();
    }
  });

  it('caps the title', () => {
    expect(buildPlanItemInput({ title: 'x'.repeat(PLAN_LIMITS.title) }, PUBLIC).error).toBeUndefined();
    expect(buildPlanItemInput({ title: 'x'.repeat(PLAN_LIMITS.title + 1) }, PUBLIC).error).toMatch(
      /160 characters/
    );
  });

  it('trims the title and collapses a blank body to null', () => {
    const result = buildPlanItemInput({ title: '  Spaced out  ', body: '   ' }, PUBLIC);
    expect(result.value.title).toBe('Spaced out');
    expect(result.value.body).toBeNull();
  });

  it('caps the body', () => {
    expect(buildPlanItemInput({ title: 't', body: 'x'.repeat(PLAN_LIMITS.body) }, PUBLIC).error).toBeUndefined();
    expect(buildPlanItemInput({ title: 't', body: 'x'.repeat(PLAN_LIMITS.body + 1) }, PUBLIC).error).toMatch(
      /8000 characters/
    );
  });

  it('survives a body that is not an object at all', () => {
    for (const body of [null, undefined, 'a string', 42, [1, 2, 3]]) {
      expect(buildPlanItemInput(body, PUBLIC).error).toBeTruthy();
    }
  });
});

describe('buildPlanItemInput — the staff door', () => {
  it('requires an explicit kind and refuses the public-only one', () => {
    expect(buildPlanItemInput({ title: 't' }, STUDIO).error).toMatch(/Kind must be one of/);
    expect(buildPlanItemInput({ title: 't', kind: 'suggestion' }, STUDIO).error).toMatch(/Kind must be one of/);
  });

  it('accepts each staff kind', () => {
    for (const kind of STAFF_KINDS) {
      const result = buildPlanItemInput({ title: 't', kind }, STUDIO);
      expect(result.error).toBeUndefined();
      expect(result.value.kind).toBe(kind);
    }
  });

  it('normalises kind and priority casing', () => {
    const result = buildPlanItemInput({ title: 't', kind: 'BUG', priority: 'High' }, STUDIO);
    expect(result.value).toMatchObject({ kind: 'bug', priority: 'high' });
  });

  it('takes the author from the session and never from the body', () => {
    const result = buildPlanItemInput(
      {
        title: 't',
        kind: 'task',
        author_id: 'deadbeef-dead-beef-dead-beefdeadbeef',
        author_email: 'someone-else@example.com',
        author_name: 'Someone Else',
        source: 'public',
        page_url: 'https://example.com',
      },
      STUDIO
    );
    expect(result.value).toMatchObject({
      source: 'studio',
      author_id: STUDIO.author.id,
      author_email: 'rory@roryskagenart.com',
      author_name: 'Rory Skagen',
      page_url: null,
    });
  });

  it('drops an unusable profile name rather than storing junk', () => {
    const result = buildPlanItemInput(
      { title: 't', kind: 'task' },
      { door: 'studio', author: { id: 'a', email: 'a@b.com', name: '   ' } }
    );
    expect(result.value.author_name).toBeNull();

    const long = buildPlanItemInput(
      { title: 't', kind: 'task' },
      { door: 'studio', author: { id: 'a', email: 'a@b.com', name: 'x'.repeat(PLAN_LIMITS.name + 1) } }
    );
    expect(long.value.author_name).toBeNull();
  });

  it('tolerates a session with no email at all', () => {
    const result = buildPlanItemInput({ title: 't', kind: 'idea' }, { door: 'studio', author: null });
    expect(result.value.author_email).toBeNull();
    expect(result.value.author_id).toBeNull();
  });

  it('validates the priority vocabulary', () => {
    expect(buildPlanItemInput({ title: 't', kind: 'idea', priority: 'urgent' }, STUDIO).error).toMatch(
      /Priority must be one of/
    );
    expect(buildPlanItemInput({ title: 't', kind: 'idea', priority: '' }, STUDIO).value.priority).toBeNull();
  });

  it('accepts a release label and caps it', () => {
    expect(buildPlanItemInput({ title: 't', kind: 'idea', target_release: ' v3.4.0 ' }, STUDIO).value.target_release).toBe(
      'v3.4.0'
    );
    expect(
      buildPlanItemInput({ title: 't', kind: 'idea', target_release: 'x'.repeat(PLAN_LIMITS.release + 1) }, STUDIO).error
    ).toMatch(/60 characters/);
  });
});

describe('buildPlanItemPatch', () => {
  const at = (status: PlanStatus) => ({ current: { status } });

  it('ignores unknown keys so the client can send a whole row back', () => {
    const result = buildPlanItemPatch(
      { title: 'Renamed', id: 'nope', created_at: 'nope', updated_at: 'nope', nonsense: true },
      at('new')
    );
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ title: 'Renamed' });
  });

  it('refuses provenance fields, even though they are real columns', () => {
    for (const body of [
      { source: 'studio' },
      { author_id: 'deadbeef-dead-beef-dead-beefdeadbeef' },
      { author_email: 'x@y.com' },
      { source_ref: 'artwork:x' },
    ]) {
      expect(buildPlanItemPatch(body, at('new')).error).toMatch(/No updatable fields/);
    }
  });

  it('rejects an empty patch and a non-object body', () => {
    for (const body of [{}, null, undefined, 'x', [1, 2]]) {
      expect(buildPlanItemPatch(body, at('new')).error).toBeTruthy();
    }
  });

  it('applies the title and body rules', () => {
    expect(buildPlanItemPatch({ title: '  ok  ' }, at('new')).value.title).toBe('ok');
    expect(buildPlanItemPatch({ title: '' }, at('new')).error).toBeTruthy();
    expect(buildPlanItemPatch({ body: '' }, at('new')).value.body).toBeNull();
    expect(buildPlanItemPatch({ body: 'x'.repeat(PLAN_LIMITS.body + 1) }, at('new')).error).toMatch(/8000/);
  });

  it('restricts kind to the staff vocabulary', () => {
    expect(buildPlanItemPatch({ kind: 'feature' }, at('new')).value.kind).toBe('feature');
    expect(buildPlanItemPatch({ kind: 'suggestion' }, at('new')).error).toMatch(/cannot be set/);
  });

  it('allows a legal status move and reports the illegal ones with what is allowed', () => {
    expect(buildPlanItemPatch({ status: 'accepted' }, at('new')).value.status).toBe('accepted');
    expect(buildPlanItemPatch({ status: 'planned' }, at('in_progress')).error).toMatch(/Cannot move/);
    expect(buildPlanItemPatch({ status: 'planned' }, at('in_progress')).error).toMatch(/Allowed from here/);
  });

  it('drops a status that is already the current one, so updated_at is not churned', () => {
    // The client sends the whole row back; an unchanged status must not count as a change.
    expect(buildPlanItemPatch({ status: 'new', title: 'x' }, at('new')).value).toEqual({ title: 'x' });
    expect(buildPlanItemPatch({ status: 'new' }, at('new')).error).toMatch(/No updatable fields/);
  });

  it('validates a status that is not in the vocabulary', () => {
    expect(buildPlanItemPatch({ status: 'shipped' }, at('new')).error).toMatch(/Status must be one of/);
  });

  it('clears priority and release with an empty value', () => {
    expect(buildPlanItemPatch({ priority: null }, at('new')).value.priority).toBeNull();
    expect(buildPlanItemPatch({ priority: '' }, at('new')).value.priority).toBeNull();
    expect(buildPlanItemPatch({ target_release: null }, at('new')).value.target_release).toBeNull();
    expect(buildPlanItemPatch({ priority: 'urgent' }, at('new')).error).toMatch(/Priority must be one of/);
  });
});

describe('the status-transition map', () => {
  it('lets a same-status move through as a no-op', () => {
    for (const status of Object.keys(STATUS_TRANSITIONS) as PlanStatus[]) {
      expect(canTransitionStatus(status, status)).toBe(true);
    }
  });

  it('refuses to decline something already shipped, and to un-ship it directly', () => {
    expect(canTransitionStatus('done', 'declined')).toBe(false);
    expect(canTransitionStatus('done', 'planned')).toBe(false);
    expect(canTransitionStatus('done', 'in_progress')).toBe(true);
  });

  it('lets a declined item be reconsidered', () => {
    expect(canTransitionStatus('declined', 'new')).toBe(true);
    expect(canTransitionStatus('declined', 'accepted')).toBe(true);
    expect(canTransitionStatus('declined', 'done')).toBe(false);
  });

  it('lets anything open be closed as done, because a small board needs no ceremony', () => {
    for (const status of ['new', 'accepted', 'planned', 'in_progress'] as PlanStatus[]) {
      expect(canTransitionStatus(status, 'done')).toBe(true);
    }
  });

  it('never lists a status as reachable from itself', () => {
    for (const [from, tos] of Object.entries(STATUS_TRANSITIONS)) {
      expect(tos).not.toContain(from);
    }
    expect(nextStatuses('new')).not.toContain('new');
  });

  it('never points at a status outside the vocabulary', () => {
    const vocabulary = Object.keys(STATUS_TRANSITIONS);
    for (const tos of Object.values(STATUS_TRANSITIONS)) {
      for (const to of tos) expect(vocabulary).toContain(to);
    }
  });
});

describe('buildListFilters', () => {
  it('defaults to an unfiltered, capped list', () => {
    expect(buildListFilters(undefined).value).toEqual({
      kind: null,
      status: null,
      target_release: null,
      limit: PLAN_LIST_DEFAULT_LIMIT,
    });
  });

  it('normalises the values it accepts', () => {
    expect(buildListFilters({ kind: 'BUG', status: 'In_Progress', release: ' v3.4.0 ', limit: '10' }).value).toEqual({
      kind: 'bug',
      status: 'in_progress',
      target_release: 'v3.4.0',
      limit: 10,
    });
  });

  it('collapses a repeated parameter instead of stringifying it', () => {
    expect(buildListFilters({ kind: ['bug', 'idea'] }).value.kind).toBe('bug');
  });

  it('treats blank values as no filter', () => {
    expect(buildListFilters({ kind: '', status: '  ', release: '', limit: '' }).value).toEqual({
      kind: null,
      status: null,
      target_release: null,
      limit: PLAN_LIST_DEFAULT_LIMIT,
    });
  });

  /**
   * A filter that silently matches nothing is indistinguishable from one that correctly
   * matches nothing — so an unrecognised value is an error, not an empty board.
   */
  it('refuses a value it does not recognise rather than returning nothing', () => {
    expect(buildListFilters({ kind: 'feature-request' }).error).toMatch(/Kind filter/);
    expect(buildListFilters({ status: 'shipped' }).error).toMatch(/Status filter/);
  });

  it('bounds the limit', () => {
    for (const limit of ['0', '-1', '1.5', 'abc', String(PLAN_LIST_MAX_LIMIT + 1)]) {
      expect(buildListFilters({ limit }).error).toMatch(/Limit must be a whole number/);
    }
    expect(buildListFilters({ limit: String(PLAN_LIST_MAX_LIMIT) }).value.limit).toBe(PLAN_LIST_MAX_LIMIT);
  });
});

describe('the route’s SQL is internally consistent', () => {
  /**
   * A column list and a parameter list that disagree is a runtime error TypeScript cannot see —
   * `pool.query(text, values)` takes `any[]`. This reads the route source, so adding a column
   * without a placeholder (or the reverse) fails here rather than at the first public submission.
   *
   * Same source-reading idiom as `bundleSafety.test.ts` and `adminNavGuard.test.ts`.
   */
  const routeSource = () =>
    readFileSync(path.join(__dirname, '../../server/routes/plan.ts'), 'utf8').replace(/\r\n/g, '\n');

  it('binds every INSERT column to exactly one placeholder', () => {
    const insert = /INSERT INTO public\.plan_items \(([\s\S]*?)\) VALUES \(([\s\S]*?)\)/.exec(routeSource());
    expect(insert, 'the plan_items INSERT could not be located — this guard is blind.').toBeTruthy();

    const columns = insert![1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const placeholders = [...insert![2].matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));

    expect(columns.length).toBe(placeholders.length);
    // Numbered 1..n in order, so a gap or a repeat cannot hide behind the count matching.
    expect(placeholders).toEqual(columns.map((_, index) => index + 1));
  });

  it('uses one shared column list for every read, so the shapes cannot drift', () => {
    const code = routeSource();
    expect(code).toMatch(/const ITEM_COLUMNS = `/);
    expect(code).toMatch(/SELECT \$\{ITEM_COLUMNS\}/);
    expect(code).toMatch(/RETURNING \$\{ITEM_COLUMNS\}/);
  });

  it('builds the PATCH from the allow-list map rather than from request keys', () => {
    const code = routeSource();
    expect(code).toContain('Object.entries(PATCH_COLUMNS)');
    // The column name must come from the map. A template built from a body key would be injection.
    expect(code).not.toMatch(/sets\.push\(`\$\{[a-zA-Z]*[Kk]ey/);
  });
});

describe('guards and small readers', () => {
  it('recognises only the vocabulary it documents', () => {
    expect(isPlanKind('suggestion')).toBe(true);
    expect(isPlanKind('Suggestion')).toBe(false);
    expect(isStaffKind('suggestion')).toBe(false);
    expect(isStaffKind('task')).toBe(true);
    expect(isPlanStatus('in_progress')).toBe(true);
    expect(isPlanStatus('in-progress')).toBe(false);
    expect(isPlanPriority('high')).toBe(true);
    expect(isPlanPriority('urgent')).toBe(false);
  });

  it('validates an id before letting Postgres cast it', () => {
    expect(isUuid('11111111-1111-1111-1111-111111111111')).toBe(true);
    for (const value of ['1', '', 'not-a-uuid', 42, null, undefined, '11111111-1111-1111-1111-11111111111']) {
      expect(isUuid(value)).toBe(false);
    }
  });

  it('returns null for a page_url it cannot use', () => {
    expect(readPageUrl('https://a.example/x')).toBe('https://a.example/x');
    expect(readPageUrl('ftp://a.example')).toBeNull();
    expect(readPageUrl(42)).toBeNull();
  });
});
