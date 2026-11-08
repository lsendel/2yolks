// Test helper: in-memory D1 over node:sqlite with all migrations applied.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
export function makeD1(sqlite: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let bound: unknown[] = [];
    const stmt = () => sqlite.prepare(sql);
    return {
      bind(...values: unknown[]) {
        bound = values;
        return this;
      },
      async run() {
        const info = stmt().run(...(bound as never[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes),
            last_row_id: Number(info.lastInsertRowid),
            duration: 0,
            size_after: 0,
            rows_read: 0,
            rows_written: Number(info.changes),
            changed_db: Number(info.changes) > 0,
            served_by: 'test',
          },
        };
      },
      async all() {
        return {
          results: stmt().all(...(bound as never[])),
          success: true,
          meta: { duration: 0, size_after: 0, rows_read: 0, rows_written: 0, changed_db: false, served_by: 'test' },
        };
      },
      async first(col?: string) {
        const row = stmt().get(...(bound as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (col) return row[col] ?? null;
        return row;
      },
      async raw() {
        const st = stmt();
        st.setReturnArrays(true); // duplicate column names (joins) must not collapse
        return st.all(...(bound as never[])) as unknown as unknown[][];
      },
    };
  };
  const d1 = {
    prepare,
    async batch(statements: { run: () => Promise<unknown> }[]) {
      sqlite.exec('BEGIN');
      try {
        const out = [];
        for (const s of statements) out.push(await s.run());
        sqlite.exec('COMMIT');
        return out;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
    exec(sql: string) {
      sqlite.exec(sql);
      return Promise.resolve({ count: 0, duration: 0 });
    },
    dump() {
      throw new Error('not implemented');
    },
    withSession() {
      return d1;
    },
  };
  return d1 as unknown as D1Database;
}

export function migratedD1All(): D1Database {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of ['0001_init.sql', '0002_mcp_blog.sql', '0003_quality_translation.sql', '0004_recipe_times_images.sql', '0005_recipe_slug_aliases.sql', '0006_user_accounts.sql', '0008_recipe_test_reports.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  return makeD1(sqlite);
}
