/**
 * Read-only schema introspection.
 *
 * Dumps the live `public` schema — tables, columns, constraints, indexes,
 * triggers, functions, RLS status, policies, and row counts — as a markdown
 * report. Performs NO writes to the database.
 *
 * Why: the core domain tables (artworks, media_assets, pages, inquiries) were
 * created directly in the Supabase project and are now captured by
 * `supabase/migrations/2026_09_01_baseline_core_tables.sql`. This report is how
 * that baseline is verified against production — and how any drift is detected.
 * See docs/adr/0001.
 *
 * Usage:
 *   npx tsx scripts/introspect-schema.ts                  # → data/archive/schema_introspection.md
 *   npx tsx scripts/introspect-schema.ts --out ./tmp/x.md # explicit destination
 *
 * The report is written by this script rather than to stdout so that unrelated
 * stdout noise (dotenv's banner, for one) cannot contaminate the artifact.
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function getConnectionString(): string {
  const raw =
    process.env.VRCL_SUPA_POSTGRES_PRISMA_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL ||
    process.env.VRCL_SUPA_POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    '';
  if (!raw) throw new Error('PostgreSQL connection string missing from environment.');
  // Strip query params so pg SSL configuration is authoritative (matches run-migrations.ts)
  return raw.replace(/\?.*$/, '');
}

const pool = new Pool({
  connectionString: getConnectionString(),
  ssl: { rejectUnauthorized: false },
});

/** Buffered so the report is written as one clean file — see the docblock. */
const out: string[] = [];
const line = (s = '') => out.push(s);
const section = (t: string) => line(`\n## ${t}\n`);

async function main(): Promise<void> {
  line('# Live `public` schema introspection');
  line();
  const meta = await pool.query(
    `SELECT current_database() AS db, current_user AS usr, version() AS v`
  );
  line(`- Database: \`${meta.rows[0].db}\``);
  line(`- Connected as: \`${meta.rows[0].usr}\``);
  line(`- Generated: ${new Date().toISOString()}`);
  line(`- Server: ${String(meta.rows[0].v).split(',')[0]}`);

  // ---------------------------------------------------------------- tables
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );
  section('Tables');
  for (const t of tables.rows) line(`- \`${t.table_name}\``);

  // --------------------------------------------------------------- columns
  const cols = await pool.query(
    `SELECT table_name, column_name, data_type, udt_name, is_nullable,
            column_default, character_maximum_length, numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`
  );
  section('Columns');
  let currentTable = '';
  for (const c of cols.rows) {
    if (c.table_name !== currentTable) {
      currentTable = c.table_name;
      line(`\n### \`${currentTable}\``);
      line();
      line('| column | type | null | default |');
      line('| :--- | :--- | :--- | :--- |');
    }
    let type = c.data_type;
    if (c.character_maximum_length) type += `(${c.character_maximum_length})`;
    if (c.numeric_precision && c.data_type === 'numeric') type += `(${c.numeric_precision},${c.numeric_scale})`;
    const def = c.column_default ? `\`${String(c.column_default).replace(/\|/g, '\\|')}\`` : '';
    line(`| \`${c.column_name}\` | ${type} | ${c.is_nullable} | ${def} |`);
  }

  // ----------------------------------------------------------- constraints
  const cons = await pool.query(
    `SELECT conrelid::regclass::text AS tbl, conname, contype,
            pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
      ORDER BY conrelid::regclass::text, conname`
  );
  section('Constraints (PK / FK / UNIQUE / CHECK)');
  for (const c of cons.rows) {
    const kind = { p: 'PK', f: 'FK', u: 'UNIQUE', c: 'CHECK', x: 'EXCLUDE' }[c.contype] ?? c.contype;
    line(`- \`${c.tbl}\` **${kind}** \`${c.conname}\`: ${c.def}`);
  }

  // --------------------------------------------------------------- indexes
  const idx = await pool.query(
    `SELECT tablename, indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' ORDER BY tablename, indexname`
  );
  section('Indexes');
  for (const i of idx.rows) line(`- \`${i.tablename}\`: ${i.indexdef}`);

  // -------------------------------------------------------------- triggers
  const trg = await pool.query(
    `SELECT tgname, tgrelid::regclass::text AS tbl, pg_get_triggerdef(oid) AS def
       FROM pg_trigger WHERE NOT tgisinternal
      ORDER BY tgrelid::regclass::text, tgname`
  );
  section('Triggers');
  if (!trg.rows.length) line('_(none)_');
  for (const t of trg.rows) line(`- \`${t.tbl}\` \`${t.tgname}\`:\n  \`\`\`sql\n  ${t.def}\n  \`\`\``);

  // ------------------------------------------------------------- functions
  const fns = await pool.query(
    `SELECT proname, pg_get_functiondef(oid) AS def
       FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prokind = 'f'
      ORDER BY proname`
  );
  section('Functions');
  if (!fns.rows.length) line('_(none)_');
  for (const f of fns.rows) line(`\n#### \`${f.proname}\`\n\n\`\`\`sql\n${f.def}\n\`\`\``);

  // ------------------------------------------------------------------- RLS
  const rls = await pool.query(
    `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
      ORDER BY relname`
  );
  section('Row Level Security');
  line('| table | rls_enabled | forced |');
  line('| :--- | :--- | :--- |');
  for (const r of rls.rows) line(`| \`${r.relname}\` | ${r.relrowsecurity} | ${r.relforcerowsecurity} |`);

  const pol = await pool.query(
    `SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check
       FROM pg_policies WHERE schemaname = 'public'
      ORDER BY tablename, policyname`
  );
  section('Policies');
  if (!pol.rows.length) line('_(none)_');
  for (const p of pol.rows) {
    line(`\n- \`${p.tablename}\` **${p.policyname}** (${p.cmd}) roles=${p.roles}`);
    if (p.qual) line(`  - USING: \`${p.qual}\``);
    if (p.with_check) line(`  - WITH CHECK: \`${p.with_check}\``);
  }

  // ------------------------------------------------------------ row counts
  section('Row counts');
  line('| table | rows |');
  line('| :--- | ---: |');
  for (const t of tables.rows) {
    const c = await pool.query(`SELECT count(*)::int AS n FROM public."${t.table_name}"`);
    line(`| \`${t.table_name}\` | ${c.rows[0].n} |`);
  }

  // -------------------------------------------------- applied migrations
  const mig = await pool.query(
    `SELECT filename, applied_at FROM public.schema_migrations ORDER BY filename`
  );
  section('Applied migrations (public.schema_migrations)');
  for (const m of mig.rows) line(`- \`${m.filename}\` — ${m.applied_at.toISOString()}`);

  await pool.end();

  const flag = process.argv.indexOf('--out');
  const outPath =
    flag !== -1 && process.argv[flag + 1]
      ? path.resolve(process.cwd(), process.argv[flag + 1])
      : path.resolve(process.cwd(), 'data', 'archive', 'schema_introspection.md');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out.join('\n') + '\n');
  console.log(
    `Wrote ${path.relative(process.cwd(), outPath)} — ${tables.rows.length} tables, ` +
      `${mig.rows.length} recorded migrations.`
  );
}

main().catch(async (err) => {
  console.error('Introspection error:', err?.message || err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
