import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const apiMock = vi.fn();
vi.mock('../../lib/adminApi', () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

import { UsersAdminView } from './UsersAdminView';
import type { AuthUser } from '../../types';

const ADMIN: AuthUser = {
  id: 'u-1',
  email: 'test@riolabs.ai',
  name: 'Jaden Test',
  role: 'admin',
  createdAt: '2026-09-01T00:00:00Z',
};

const USERS = [
  {
    id: 'u-1',
    email: 'test@riolabs.ai',
    name: 'Jaden Test',
    role: 'admin',
    isActive: true,
    lastSignInAt: '2026-09-14T10:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    invitedAt: null,
    confirmedAt: '2026-09-01T00:00:00Z',
    confirmationSentAt: null,
    invitePending: false,
  },
  {
    id: 'u-2',
    email: 'curator@roryskagenart.com',
    name: 'New Curator',
    role: 'editor',
    isActive: true,
    lastSignInAt: null,
    createdAt: '2026-09-12T00:00:00Z',
    invitedAt: '2026-09-12T00:00:00Z',
    confirmedAt: null,
    confirmationSentAt: '2026-09-12T00:00:00Z',
    invitePending: true,
  },
  {
    id: 'u-3',
    email: 'rory@bluegenieart.com',
    name: 'Rory Skagen',
    role: 'admin',
    isActive: true,
    lastSignInAt: null,
    createdAt: '2026-09-10T00:00:00Z',
    invitedAt: null,
    confirmedAt: '2026-09-10T00:00:00Z',
    confirmationSentAt: null,
    invitePending: false,
  },
];

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockResolvedValue({ users: USERS });
});

describe('UsersAdminView', () => {
  it('lists the studio users with role labels and a pending-invite badge', async () => {
    render(<UsersAdminView currentUser={ADMIN} />);

    await waitFor(() => expect(screen.getByText('curator@roryskagenart.com')).toBeInTheDocument());

    // Scoped to the table so the role legend below is not counted.
    const table = within(screen.getByRole('table'));
    expect(table.getAllByText('Administrator')).toHaveLength(2);
    expect(table.getByText('Editor')).toBeInTheDocument();
    expect(table.getByText(/invite pending/i)).toBeInTheDocument();
    expect(screen.getByText(/1 invite pending/i)).toBeInTheDocument();
  });

  it('explains what each role can do', async () => {
    render(<UsersAdminView currentUser={ADMIN} />);
    await waitFor(() => expect(screen.getByText(/what each role can do/i)).toBeInTheDocument());

    expect(screen.getByText(/full control: catalog, pages, media, settings/i)).toBeInTheDocument();
    expect(screen.getByText(/read-only access to the studio dashboard/i)).toBeInTheDocument();
  });

  it('offers Resend invitation only for a pending invite', async () => {
    const user = userEvent.setup();
    render(<UsersAdminView currentUser={ADMIN} />);
    await waitFor(() => expect(screen.getByText('curator@roryskagenart.com')).toBeInTheDocument());

    // The pending invitee's row menu carries the resend action.
    await user.click(screen.getByLabelText('Actions for curator@roryskagenart.com'));
    expect(await screen.findByText(/resend invitation/i)).toBeInTheDocument();
    expect(screen.getByText(/send password reset/i)).toBeInTheDocument();

    await user.keyboard('{Escape}');

    // A confirmed user's row menu does not.
    await user.click(screen.getByLabelText('Actions for rory@bluegenieart.com'));
    expect(await screen.findByText(/send password reset/i)).toBeInTheDocument();
    expect(screen.queryByText(/resend invitation/i)).toBeNull();
  });

  it('blocks self-service role changes and says why', async () => {
    const user = userEvent.setup();
    render(<UsersAdminView currentUser={ADMIN} />);
    await waitFor(() => expect(screen.getByText('test@riolabs.ai')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Actions for test@riolabs.ai'));

    expect(await screen.findByText(/cannot change your own role or access/i)).toBeInTheDocument();
    // No delete option against yourself.
    expect(screen.queryByText(/delete user/i)).toBeNull();
  });

  it('opens the edit dialog pre-filled with the user', async () => {
    const user = userEvent.setup();
    render(<UsersAdminView currentUser={ADMIN} />);
    await waitFor(() => expect(screen.getByText('curator@roryskagenart.com')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Actions for curator@roryskagenart.com'));
    await user.click(await screen.findByText(/edit user details/i));

    expect(await screen.findByLabelText('Name')).toHaveValue('New Curator');
    expect(screen.getByLabelText('Email')).toHaveValue('curator@roryskagenart.com');
    expect(screen.getByLabelText('Role')).toHaveValue('editor');
    expect(screen.getByLabelText('Studio access')).toBeChecked();
  });

  it('sends only the changed fields when saving an edit', async () => {
    const user = userEvent.setup();
    render(<UsersAdminView currentUser={ADMIN} />);
    await waitFor(() => expect(screen.getByText('curator@roryskagenart.com')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Actions for curator@roryskagenart.com'));
    await user.click(await screen.findByText(/edit user details/i));
    await user.clear(await screen.findByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Studio Curator');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('/api/admin/users/u-2', {
        method: 'PATCH',
        body: { name: 'Studio Curator' },
      })
    );
  });

  it('surfaces the API guard when a mutation is refused', async () => {
    const user = userEvent.setup();
    apiMock
      .mockResolvedValueOnce({ users: USERS })
      .mockRejectedValueOnce(
        new Error('rory@bluegenieart.com is the only active administrator.')
      );

    render(<UsersAdminView currentUser={ADMIN} />);
    await waitFor(() => expect(screen.getByText('curator@roryskagenart.com')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Actions for curator@roryskagenart.com'));
    await user.click(await screen.findByText(/make administrator/i));

    expect(
      await screen.findByText(/is the only active administrator/i)
    ).toBeInTheDocument();
  });

  it('filters the list by search', async () => {
    const user = userEvent.setup();
    render(<UsersAdminView currentUser={ADMIN} />);
    await waitFor(() => expect(screen.getByText('curator@roryskagenart.com')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/search name, email or role/i), 'curator');

    expect(screen.getByText('curator@roryskagenart.com')).toBeInTheDocument();
    expect(screen.queryByText('rory@bluegenieart.com')).toBeNull();
  });
});
