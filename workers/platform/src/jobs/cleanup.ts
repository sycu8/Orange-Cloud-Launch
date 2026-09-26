/** Expiry cleanup for shares, challenges, and stale auth challenges. Safe to rerun. */
export async function runCleanup(env: { DB: D1Database }): Promise<{
  revokedShares: number;
  expiredChallenges: number;
  expiredDomainChallenges: number;
}> {
  const now = new Date().toISOString();
  const shares = await env.DB.prepare(
    `UPDATE report_shares SET revoked_at = ?
     WHERE revoked_at IS NULL AND expires_at IS NOT NULL AND expires_at < ?`,
  )
    .bind(now, now)
    .run();
  const challenges = await env.DB.prepare(
    `UPDATE auth_challenges SET consumed_at = COALESCE(consumed_at, ?)
     WHERE consumed_at IS NULL AND expires_at < ?`,
  )
    .bind(now, now)
    .run();
  const domains = await env.DB.prepare(
    `UPDATE domains SET state = 'suspended'
     WHERE state = 'ownership_pending' AND challenge_expires_at IS NOT NULL AND challenge_expires_at < ?`,
  )
    .bind(now)
    .run();
  return {
    revokedShares: shares.meta.changes ?? 0,
    expiredChallenges: challenges.meta.changes ?? 0,
    expiredDomainChallenges: domains.meta.changes ?? 0,
  };
}
