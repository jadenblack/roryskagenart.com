#!/usr/bin/env npx tsx
/**
 * Delete inquiry rows from the live catalog — housekeeping, with a safety model.
 *
 * WHY THIS EXISTS
 * `#/admin → Inquiries` can only *close* an inquiry; there is no DELETE route anywhere in the
 * server, so a test row submitted while proving the mailer could never be removed. This is the
 * supported way to do it, and it is deliberately the slow way:
 *
 *   - it is **read-only by default** — without `--apply` it prints the rows and exits;
 *   - it resolves every id and **prints the row before deleting it**, so you see what goes;
 *   - it deletes **only the ids named**, one `DELETE … WHERE id = $1` per id;
 *   - it **re-reads afterwards** and reports what is actually gone.
 *
 * Usage:
 *   npx tsx scripts/delete-inquiries.ts --list                 # show every inquiry, read-only
 *   npx tsx scripts/delete-inquiries.ts --id <uuid>            # dry run — show what would go
 *   npx tsx scripts/delete-inquiries.ts --id <uuid> --apply    # actually delete
 *
 * Exit codes: 0 = done · 1 = refused or failed · 2 = nothing to do.
 *
 * ⚠️ Take a dump first: `npx tsx scripts/backup-catalog.ts`. There is no undo — see
 * docs/runbooks/database-backup-restore.md §4a for the row-level rollback, which works because
 * `inquiries.json` in any dump holds the full row.
 *
 * Writes go through `getSupabaseAdmin()` (service role, bypasses RLS) — one of the two write
 * paths named in AGENTS.md §4. Never paste SQL into the dashboard for this.
 */
import dotenv from 'dotenv';
import { getSupabaseAdmin } from '../src/server/db';

dotenv.config();
dotenv.config({ path: '.env.local', override: false });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fields shown when identifying a row — enough to tell a test row from a real lead. */
const PREVIEW_FIELDS = 'id, name, email, message, status, email_status, created_at';

interface InquiryRow {
  id: string;
  name?: string | null;
  email?: string | null;
  message?: string | null;
  status?: string | null;
  email_status?: string | null;
  created_at?: string | null;
}

function preview(row: InquiryRow): string {
  const who = `${row.name ?? '(no name)'} <${row.email ?? '(no email)'}>`;
  const message = (row.message ?? '').replace(/\s+/g, ' ').slice(0, 70);
  const when = row.created_at ? String(row.created_at).slice(0, 19).replace('T', ' ') : '?';
  return `${row.id}  ${when}  ${who}  [${row.status ?? '?'}/${row.email_status ?? '?'}]  "${message}"`;
}

function main(): void {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const ids = args
    .map((a, i) => (a === '--id' ? args[i + 1] : undefined))
    .filter((v): v is string => Boolean(v));

  const listOnly = flag('--list');
  const apply = flag('--apply');

  void (async () => {
    const supabase = getSupabaseAdmin();

    if (listOnly) {
      const { data, error } = await supabase
        .from('inquiries')
        .select(PREVIEW_FIELDS)
        .order('created_at', { ascending: true });
      if (error) {
        console.error(`✗ Could not read inquiries: ${error.message}`);
        process.exit(1);
      }
      const rows = (data ?? []) as InquiryRow[];
      console.log(`${rows.length} inquiry row(s):`);
      for (const row of rows) console.log(`  ${preview(row)}`);
      process.exit(rows.length === 0 ? 2 : 0);
    }

    if (ids.length === 0) {
      console.error('✗ Nothing to do. Pass --id <uuid> (repeatable), or --list to see the rows.');
      process.exit(1);
    }

    const bad = ids.filter((id) => !UUID_RE.test(id));
    if (bad.length > 0) {
      console.error(`✗ Refusing — not a UUID: ${bad.join(', ')}`);
      process.exit(1);
    }

    const { data, error } = await supabase
      .from('inquiries')
      .select(PREVIEW_FIELDS)
      .in('id', ids);
    if (error) {
      console.error(`✗ Could not read inquiries: ${error.message}`);
      process.exit(1);
    }

    const found = (data ?? []) as InquiryRow[];
    if (found.length === 0) {
      console.error('✗ No inquiry row matches any of those ids — nothing deleted.');
      process.exit(2);
    }

    const missing = ids.filter((id) => !found.some((r) => r.id === id));
    if (missing.length > 0) {
      console.error(`✗ Refusing — these ids do not exist: ${missing.join(', ')}`);
      process.exit(1);
    }

    console.log(`${apply ? 'Deleting' : 'Would delete'} ${found.length} inquiry row(s):`);
    for (const row of found) console.log(`  ${preview(row)}`);

    if (!apply) {
      console.log('\nDry run — nothing was changed. Re-run with --apply to delete.');
      process.exit(0);
    }

    let deleted = 0;
    for (const row of found) {
      const { error: delError, count } = await supabase
        .from('inquiries')
        .delete({ count: 'exact' })
        .eq('id', row.id);
      if (delError) {
        console.error(`✗ Failed to delete ${row.id}: ${delError.message}`);
        process.exit(1);
      }
      deleted += count ?? 0;
    }

    // Re-read: report what is actually gone rather than trusting the mutation result.
    const { data: after } = await supabase.from('inquiries').select('id').in('id', ids);
    const stillThere = ((after ?? []) as { id: string }[]).map((r) => r.id);

    console.log(`\nDeleted ${deleted} row(s). ${stillThere.length} still present.`);
    const { count: remaining } = await supabase
      .from('inquiries')
      .select('id', { count: 'exact', head: true });
    console.log(`inquiries now holds ${remaining ?? '?'} row(s).`);
    process.exit(stillThere.length === 0 ? 0 : 1);
  })().catch((err: unknown) => {
    console.error('✗ Failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

main();
