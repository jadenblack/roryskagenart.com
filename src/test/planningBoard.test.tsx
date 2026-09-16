import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const apiMock = vi.fn();
vi.mock('../lib/adminApi', () => (({
  api: (...args: unknown[]) => apiMock(...args),
})));

import { PlanningView } from '../components/admin/PlanningView';

/**
 * The board's `v3.2.0` grouping — tasks 3 and 4 of the release.
 *
 * The behaviour worth pinning is the one that is easy to get subtly wrong and invisible in a
 * screenshot: **moving an item sends the release's `id`, never its version**, and **ungrouping
 * sends `null`**. `buildPlanItemPatch` rejects anything that is not a uuid, so a UI that sent
 * `v3.2.0` would fail only in production.
 */

const RELEASE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RELEASE_ID = '22222222-2222-4222-8222-222222222222';

const ITEMS = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    kind: 'bug',
    title: 'Hero image crops wrong',
    body: 'It cuts the signature off.',
    status: 'new',
    priority: 'high',
    target_release: 'v3.2.0',
    release_id: RELEASE_ID,
    source: 'public',
    source_ref: null,
    author_name: null,
    author_email: 'collector@example.com',
    page_url: 'https://roryskagenart.com/',
    created_at: '2026-09-16T10:00:00Z',
    updated_at: '2026-09-16T10:00:00Z',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    kind: 'suggestion',
    title: 'Add a dark mode',
    body: null,
    status: 'new',
    priority: null,
    target_release: null,
    release_id: null,
    source: 'public',
    source_ref: null,
    author_name: null,
    author_email: null,
    page_url: null,
    created_at: '2026-09-16T11:00:00Z',
    updated_at: '2026-09-16T11:00:00Z',
  },
];

const BOARD = {
  success: true,
  items: ITEMS,
  releases: ['v3.2.0'],
  planReleases: [
    { id: RELEASE_ID, version: 'v3.2.0', title: 'Group', status: 'planned' },
    { id: OTHER_RELEASE_ID, version: 'v3.3.0', title: 'Close the loop', status: 'planned' },
  ],
  summary: {
    total: 2,
    open: 2,
    awaitingTriage: 2,
    byStatus: { new: 2, accepted: 0, planned: 0, in_progress: 0, done: 0, declined: 0 },
  },
};

/** The PATCH body the board last sent for an item. */
function lastItemPatch(id: string): Record<string, unknown> | null {
  for (let i = apiMock.mock.calls.length - 1; i >= 0; i -= 1) {
    const [path, options] = apiMock.mock.calls[i] as [string, { method?: string; body?: unknown }];
    if (path === `/api/plan/items/${id}` && options?.method === 'PATCH') {
      return options.body as Record<string, unknown>;
    }
  }
  return null;
}

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/plan/items')) return BOARD;
    if (path === '/api/plan/releases') return { success: true, releases: BOARD.planReleases };
    throw new Error(`unexpected ${path}`);
  });
});

describe('PlanningView — grouping', () => {
  it('renders the flat list by default', async () => {
    render(<PlanningView />);
    await waitFor(() => expect(screen.getByText('Hero image crops wrong')).toBeTruthy());
    expect(screen.getByText('Add a dark mode')).toBeTruthy();
    // Flat means one table and no release headings.
    expect(screen.queryByText('Not filed under a release')).toBeNull();
  });

  it('groups by release, and keeps a bucket for the unfiled', async () => {
    const user = userEvent.setup();
    render(<PlanningView />);
    await waitFor(() => expect(screen.getByText('Hero image crops wrong')).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /by release/i }));

    await waitFor(() => expect(screen.getByText('Not filed under a release')).toBeTruthy());
    // `getAllByText`: a version also appears in the release-filter <option> and in each row's
    // move control, so the section heading is one of several matches.
    expect(screen.getAllByText('v3.2.0').length).toBeGreaterThan(0);
    // An empty release still gets a section — that is the signal it has not been planned.
    expect(screen.getAllByText('v3.3.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/nothing filed against this release/i).length).toBeGreaterThan(0);
  });

  it('files an item under a release by id, not by version', async () => {
    const user = userEvent.setup();
    render(<PlanningView />);
    await waitFor(() => expect(screen.getByText('Hero image crops wrong')).toBeTruthy());

    const select = screen.getByLabelText('Release for Hero image crops wrong');
    await user.selectOptions(select, OTHER_RELEASE_ID);

    await waitFor(() =>
      expect(lastItemPatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual({
        release_id: OTHER_RELEASE_ID,
      }),
    );
  });

  it('ungroups an item by sending null, not an empty string', async () => {
    const user = userEvent.setup();
    render(<PlanningView />);
    await waitFor(() => expect(screen.getByText('Hero image crops wrong')).toBeTruthy());

    const select = screen.getByLabelText('Release for Hero image crops wrong');
    await user.selectOptions(select, '');

    await waitFor(() =>
      expect(lastItemPatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual({ release_id: null }),
    );
    // `null`, never `''`: an empty string is the <select> spelling of "no release" and the
    // server's rule for it, not something to put in the database.
    expect(lastItemPatch('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')?.release_id).not.toBe('');
  });
});

describe('PlanningView — the item drawer', () => {
  it('promotes a suggestion to a staff kind in one step', async () => {
    const user = userEvent.setup();
    render(<PlanningView />);
    await waitFor(() => expect(screen.getByText('Add a dark mode')).toBeTruthy());

    // Both rows carry an "Open" button; "Add a dark mode" is the second item.
    await user.click(screen.getAllByTitle('Open')[1]);
    // The drawer's promote block only exists for a `suggestion`.
    await waitFor(() => expect(screen.getByText(/promote this suggestion/i)).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /feature request/i }));

    await waitFor(() =>
      expect(lastItemPatch('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toEqual({ kind: 'feature' }),
    );
  });

  it('shows source_ref as text and offers nothing to type', async () => {
    const user = userEvent.setup();
    render(<PlanningView />);
    await waitFor(() => expect(screen.getByText('Hero image crops wrong')).toBeTruthy());

    await user.click(screen.getAllByTitle('Open')[0]);
    await waitFor(() => expect(screen.getByText(/source reference/i)).toBeTruthy());

    // The roadmap asked for "a link field bound to source_ref"; the server refuses to patch the
    // column, so this asserts the deviation is intentional and visible rather than forgotten.
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByLabelText(/source reference/i)).toBeNull();
    expect(within(dialog).getByText(/idempotency key/i)).toBeTruthy();
  });
});
