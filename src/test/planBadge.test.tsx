import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'studio@roryskagenart.com', role: 'editor' }, logout: vi.fn() }),
}));
vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

import { AdminLayout } from '../components/admin/AdminLayout';

/**
 * The Planning unread badge — `v3.2.0` item 5.
 *
 * What this pins down is the wiring, not the arithmetic: the count arrives from `AdminApp`,
 * which reads `summary.awaitingTriage` from `GET /api/plan/items?limit=1`, and `AdminLayout`
 * has to attach it to the right nav row. A badge on the wrong row is worse than no badge —
 * it points the studio at the wrong screen.
 *
 * ⚠️ The count is fetched only for editors. `/api/plan/items` is `requireRole('editor')`, so a
 * `viewer` session would answer 403; `AdminApp` does not ask. The nav row is hidden from
 * viewers anyway (`minRole: 'editor'`), which `src/test/adminNavGuard.test.ts` asserts.
 */

function renderNav(planTriageCount: number) {
  return render(
    <AdminLayout
      currentPath="/admin"
      onNavigate={() => {}}
      inquiryCount={0}
      planTriageCount={planTriageCount}
      trashedCount={0}
    >
      <div>content</div>
    </AdminLayout>,
  );
}

describe('the Planning nav badge', () => {
  it('shows the awaiting-triage count next to Planning', () => {
    renderNav(3);

    const planning = screen.getByRole('button', { name: /planning/i });
    expect(planning.textContent).toContain('3');
  });

  it('shows nothing when there is nothing waiting', () => {
    // A permanent "0" badge is noise that trains the studio to stop looking at the number.
    renderNav(0);

    const planning = screen.getByRole('button', { name: /planning/i });
    expect(planning.textContent).not.toContain('0');
  });

  it('does not put the planning count on some other row', () => {
    renderNav(7);

    const inquiries = screen.getByRole('button', { name: /inquiries/i });
    expect(inquiries.textContent).not.toContain('7');
  });
});
