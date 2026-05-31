// On sign-in, claim all local-only rows (user_id IS NULL) for the new user so they
// sync. Marks them synced=0 and kicks a push.

import { exec } from '../db/sqlite';
import { SYNC_TABLES } from '../db/schema';
import { nowIso } from '../lib/time';
import { triggerSync } from '../sync/runSync';

export async function backfillLocalUserId(uid: string): Promise<number> {
  let total = 0;
  const now = nowIso();
  for (const table of SYNC_TABLES) {
    const res: any = await exec(`UPDATE ${table} SET user_id = ?, updated_at = ?, synced = 0 WHERE user_id IS NULL`, [
      uid,
      now,
    ]);
    total += Number(res?.rowsAffected ?? 0);
  }
  if (total > 0) {
    console.log(`[auth] back-filled ${total} local rows for ${uid}`);
    triggerSync('backfill');
  }
  return total;
}
