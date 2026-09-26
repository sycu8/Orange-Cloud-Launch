export async function overRate(
  db: D1Database,
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT hits, window_start FROM request_rates WHERE bucket = ?`)
    .bind(bucket)
    .first<{ hits: number; window_start: string }>();
  if (!row) return false;
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  if (row.window_start <= cutoff) return false;
  return row.hits >= limit;
}

/** Sliding window stored in D1. Returns true when the request is still under the limit. */
export async function consumeRate(
  db: D1Database,
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const cutoff = new Date(now - windowMs).toISOString();
  await db
    .prepare(
      `INSERT INTO request_rates (bucket, hits, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET
         hits = CASE WHEN request_rates.window_start <= ? THEN 1 ELSE request_rates.hits + 1 END,
         window_start = CASE WHEN request_rates.window_start <= ? THEN ? ELSE request_rates.window_start END`,
    )
    .bind(bucket, nowIso, cutoff, cutoff, nowIso)
    .run();
  const row = await db
    .prepare(`SELECT hits FROM request_rates WHERE bucket = ?`)
    .bind(bucket)
    .first<{ hits: number }>();
  return (row?.hits ?? 1) <= limit;
}
