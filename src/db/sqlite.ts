// op-sqlite bootstrap — opens the on-device DB (the source of truth) and runs
// migrations on app start (PRAGMA user_version gating). Device-only: never import
// this from jest/unit tests (the sync engine is tested with in-memory adapters).

import { open, type DB } from '@op-engineering/op-sqlite';
import { MIGRATIONS } from './migrations';

let _db: DB | null = null;

export function getDb(): DB {
  if (!_db) {
    _db = open({ name: 'notebook.db' });
  }
  return _db;
}

// op-sqlite has shifted its result shape across versions; normalise to a plain array.
function rowsOf(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res.rows)) return res.rows;
  if (res.rows && Array.isArray(res.rows._array)) return res.rows._array;
  return [];
}

export async function exec(sql: string, params: any[] = []) {
  return getDb().execute(sql, params);
}

export async function selectAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const res = await getDb().execute(sql, params);
  return rowsOf(res) as T[];
}

async function currentVersion(): Promise<number> {
  const res = await getDb().execute('PRAGMA user_version');
  return Number(rowsOf(res)[0]?.user_version ?? 0);
}

export async function migrate(): Promise<{ from: number; to: number }> {
  const db = getDb();
  const from = await currentVersion();
  let to = from;
  for (const m of MIGRATIONS) {
    if (m.version <= from) continue;
    await db.execute('BEGIN');
    try {
      for (const stmt of m.statements) {
        await db.execute(stmt);
      }
      await db.execute(`PRAGMA user_version = ${m.version}`); // PRAGMA can't bind params
      await db.execute('COMMIT');
      to = m.version;
    } catch (e) {
      await db.execute('ROLLBACK');
      throw e;
    }
  }
  return { from, to };
}

/** Called once at app start (App.tsx). */
export async function initDatabase(): Promise<void> {
  const db = getDb();
  await db.execute('PRAGMA journal_mode = WAL');
  const { from, to } = await migrate();
  console.log(`[db] ready · migrations user_version ${from} → ${to}`);
}
