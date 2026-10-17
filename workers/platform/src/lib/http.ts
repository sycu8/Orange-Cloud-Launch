import { apiError, type ApiErrorBody } from "@oclaunch/shared";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Env } from "../env.js";

export type AppVars = {
  requestId: string;
  userId?: string;
  csrfToken?: string;
};

export type AppEnv = { Bindings: Env; Variables: AppVars };

export function jsonOk<T>(c: Context<AppEnv>, data: T, status: ContentfulStatusCode = 200) {
  return c.json(data, status);
}

export function jsonErr(
  c: Context<AppEnv>,
  code: string,
  message: string,
  status: ContentfulStatusCode,
  opts?: { retryable?: boolean; nextAction?: string },
) {
  const body: ApiErrorBody = apiError(code, message, c.get("requestId"), opts);
  if (status === 401) {
    const origin = new URL(c.req.url).origin;
    c.header(
      "WWW-Authenticate",
      `Bearer realm="oclaunch", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    );
  }
  return c.json(body, status);
}

export function nowIso(): string {
  return new Date().toISOString();
}
