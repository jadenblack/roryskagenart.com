/**
 * A reader for a `mysqldump` / WP Migrate `.sql` file, in TypeScript.
 *
 * WHY THIS EXISTS
 * The recovered source (`wayback/centraltexasmuralsbyroryskagen-<stamp>/database.sql`) is a real
 * MariaDB dump, not HTML — the two Wayback scrapes are parsed by `waybackExtract.ts`, but this
 * file is 13.8 MB of `INSERT INTO \`kZRTSN_posts\` (…) VALUES (…), (…);`. Reading it is the only
 * way to reach the authored bodies, the real `post_date` values, the taxonomy and the attachment
 * map that the rendered-page capture never had.
 *
 * ⚠️ THE PARSER TRAP THAT ALREADY COST ONE FULL PASS
 * **Whitespace between SQL tokens is insignificant and must be DISCARDED, not accumulated.** A
 * reader that appends the space following a comma turns `post_type` into `' attachment'`, so every
 * exact-match filter silently returns **zero rows** — and the analysis then looks *empty* rather
 * than *wrong*, which is far harder to notice. `readTuple` therefore drops whitespace outside a
 * quoted value while the current token is still empty, and `readQuoted` is the only place a space
 * can enter a value.
 *
 * Escaping: MySQL writes `\'`, `\\`, `\n`, `\r`, `\t`, `\0` and doubles a literal quote as `''`.
 * Both forms are handled. An unrecognised `\x` yields `x`, which matches MySQL's own behaviour.
 *
 * PURE BY CONSTRUCTION: no `fs`, no `pg`, no `dotenv` — `src/test/bundleSafety.test.ts` enforces
 * that boundary for `scripts/lib/`, and it is what lets this be tested against inline SQL fixtures
 * instead of a 13.8 MB file.
 */

export type DumpValue = string | null;

export interface DumpTable {
  name: string;
  /** Column names from the `INSERT INTO … (cols) VALUES` clause, backticks stripped. */
  columns: string[];
  /** Row-major values; `null` represents SQL `NULL`. */
  rows: DumpValue[][];
}

/** `INSERT INTO \`tbl\` ( cols ) VALUES` — the only statement shape this reader understands. */
const INSERT_RE = /INSERT\s+INTO\s+`([A-Za-z0-9_$]+)`\s*\(([^)]*)\)\s*VALUES/gi;

/** MySQL's single-character backslash escapes. Anything else yields the character itself. */
const ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  '0': '\0',
  b: '\b',
  Z: '\u001a',
};

/**
 * Read one single-quoted SQL string.
 *
 * Accumulates by *slice* rather than character-by-character: this runs over 13.8 MB of text and a
 * per-character `push` is measurably slower for no benefit.
 */
export function readQuoted(sql: string, start: number): { value: string; next: number } {
  if (sql[start] !== "'") throw new Error(`readQuoted: expected "'" at offset ${start}`);
  const out: string[] = [];
  let i = start + 1;
  let segStart = i;

  while (i < sql.length) {
    const c = sql[i];
    if (c === '\\') {
      out.push(sql.slice(segStart, i));
      const escaped = sql[i + 1];
      if (escaped === undefined) {
        out.push('\\');
        i += 1;
      } else {
        out.push(ESCAPES[escaped] ?? escaped);
        i += 2;
      }
      segStart = i;
      continue;
    }
    if (c === "'") {
      if (sql[i + 1] === "'") {
        out.push(sql.slice(segStart, i), "'");
        i += 2;
        segStart = i;
        continue;
      }
      out.push(sql.slice(segStart, i));
      return { value: out.join(''), next: i + 1 };
    }
    i += 1;
  }
  throw new Error('readQuoted: unterminated string literal');
}

/**
 * `NULL` or the empty token both mean "no value"; everything else is a string.
 *
 * ⚠️ The `trim()` also strips whitespace that came from *inside* a quoted literal, so
 * `'  padded  '` arrives as `padded`. That is a deliberate trade: the alternative is tracking
 * whether a token was wholly quoted, and no column in the eight tables this reader touches treats
 * leading or trailing whitespace as content — while WordPress does store `' '` as a value, which
 * has to read as absent rather than as a one-character field. `text()` trims on read as well, so
 * the behaviour is consistent on every path.
 */
function finishToken(parts: string[], raw: string): DumpValue {
  const token = (parts.join('') + raw).trim();
  if (token === '' || token.toUpperCase() === 'NULL') return null;
  return token;
}

/** Read one `(…)` tuple starting at `sql[start] === '('`. */
export function readTuple(sql: string, start: number): { values: DumpValue[]; next: number } {
  if (sql[start] !== '(') throw new Error(`readTuple: expected "(" at offset ${start}`);
  const values: DumpValue[] = [];
  const parts: string[] = [];
  let i = start + 1;
  let segStart = i;

  const flush = (): void => {
    if (i > segStart) parts.push(sql.slice(segStart, i));
    values.push(finishToken(parts, ''));
    parts.length = 0;
  };

  while (i < sql.length) {
    const c = sql[i];
    if (c === "'") {
      if (i > segStart) parts.push(sql.slice(segStart, i));
      const quoted = readQuoted(sql, i);
      parts.push(quoted.value);
      i = quoted.next;
      segStart = i;
      continue;
    }
    if (c === ',') {
      if (i > segStart) parts.push(sql.slice(segStart, i));
      values.push(finishToken(parts, ''));
      parts.length = 0;
      i += 1;
      segStart = i;
      continue;
    }
    if (c === ')') {
      if (i > segStart) parts.push(sql.slice(segStart, i));
      values.push(finishToken(parts, ''));
      return { values, next: i + 1 };
    }
    // ⚠️ Whitespace outside a quoted value is insignificant. Skipping it here — rather than
    // appending it — is what keeps `post_type` from reading as `' attachment'`.
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      if (i > segStart) parts.push(sql.slice(segStart, i));
      i += 1;
      segStart = i;
      continue;
    }
    i += 1;
  }
  throw new Error('readTuple: unterminated tuple');
}

/**
 * Parse every `INSERT` in the dump in a **single pass**.
 *
 * One pass matters: the file is 13.8 MB and there are ~10 tables of interest, so a per-table scan
 * would re-walk it ten times. `tables` optionally restricts what is retained, which keeps the
 * Wordfence / `actionscheduler_*` noise out of memory (they are the bulk of the row count).
 *
 * Never throws on an unrecognised statement — the dump carries `/*!40101 SET …` and `CREATE TABLE`
 * noise that is simply skipped.
 */
export function parseDump(sql: string, tables?: readonly string[]): Map<string, DumpTable> {
  const wanted = tables ? new Set(tables) : null;
  const out = new Map<string, DumpTable>();

  INSERT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INSERT_RE.exec(sql)) !== null) {
    const name = m[1];
    if (wanted && !wanted.has(name)) continue;

    const columns = m[2]
      .split(',')
      .map((c) => c.trim().replace(/^`|`$/g, '').trim())
      .filter(Boolean);

    const table = out.get(name) ?? { name, columns, rows: [] };
    if (table.columns.length === 0) table.columns = columns;

    let i = m.index + m[0].length;
    for (;;) {
      while (i < sql.length && /\s/.test(sql[i])) i += 1;
      if (i >= sql.length || sql[i] === ';') break;
      if (sql[i] !== '(') {
        throw new Error(
          `parseDump: expected "(" for table \`${name}\` at offset ${i} ` +
            `(near ${JSON.stringify(sql.slice(i, i + 40))})`
        );
      }
      const tuple = readTuple(sql, i);
      table.rows.push(tuple.values);
      i = tuple.next;

      while (i < sql.length && /\s/.test(sql[i])) i += 1;
      if (sql[i] === ',') {
        i += 1;
        continue;
      }
      if (sql[i] === ';' || i >= sql.length) break;
      throw new Error(
        `parseDump: expected "," or ";" for table \`${name}\` at offset ${i} ` +
          `(near ${JSON.stringify(sql.slice(i, i + 40))})`
      );
    }
    out.set(name, table);
  }

  return out;
}

/** One row as a `{ column: value }` object. Convenience for the extraction layer. */
export type DumpObject = Record<string, DumpValue>;

export function toObjects(table: DumpTable): DumpObject[] {
  return table.rows.map((row) => {
    const obj: DumpObject = {};
    table.columns.forEach((col, idx) => {
      obj[col] = row[idx] ?? null;
    });
    return obj;
  });
}

/** Trim, and treat whitespace-only as absent. WordPress stores `' '` in plenty of columns. */
export function text(value: DumpValue): string {
  return (value ?? '').trim();
}

/** `null` when the column is absent or blank — so callers can tell "missing" from "empty". */
export function optionalText(value: DumpValue): string | null {
  const v = text(value);
  return v === '' ? null : v;
}
