import type { Context } from "hono";
import type { AppEnv } from "../lib/http.js";

export type MemberRole = "owner" | "maintainer" | "reviewer";

export async function getMembership(
  c: Context<AppEnv>,
  projectId: string,
  userId: string,
): Promise<MemberRole | null> {
  const row = await c.env.DB.prepare(
    `SELECT role FROM project_members WHERE project_id = ? AND user_id = ?`,
  )
    .bind(projectId, userId)
    .first<{ role: MemberRole }>();
  return row?.role ?? null;
}

export async function requireMember(
  c: Context<AppEnv>,
  projectId: string,
  roles: MemberRole[] = ["owner", "maintainer", "reviewer"],
): Promise<MemberRole | null> {
  const userId = c.get("userId");
  if (!userId) return null;
  const role = await getMembership(c, projectId, userId);
  if (!role || !roles.includes(role)) return null;
  return role;
}

export async function audit(
  c: Context<AppEnv>,
  action: string,
  resourceType: string,
  resourceId: string,
  projectId?: string,
  detail?: unknown,
) {
  const { newId } = await import("../lib/ids.js");
  const { nowIso } = await import("../lib/http.js");
  await c.env.DB.prepare(
    `INSERT INTO audit_events (id, project_id, actor_id, action, resource_type, resource_id, request_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId("aud"),
      projectId ?? null,
      c.get("userId") ?? null,
      action,
      resourceType,
      resourceId,
      c.get("requestId"),
      detail ? JSON.stringify(detail) : null,
      nowIso(),
    )
    .run();
}
