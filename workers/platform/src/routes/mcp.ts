import type { Context } from "hono";
import type { AppEnv } from "../lib/http.js";
import { SERVER_NAME, SERVER_VERSION } from "../lib/agent-discovery.js";

const PROTOCOL_VERSION = "2025-06-18";
const MAX_BODY = 64 * 1024;

type RpcId = string | number | null;

type RpcMessage = {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: unknown;
};

const TOOLS = [
  {
    name: "describe_oclaunch",
    description:
      "Describe OCLaunch and which actions an agent can take without a passkey session.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_health",
    description: "Read the OCLaunch service health payload.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_public_projects",
    description: "List projects that are public on OCLaunch Discover.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_product_passport",
    description: "Read one public or unlisted OCLaunch product passport by slug.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Project slug from Discover or a passport URL." },
      },
      required: ["slug"],
      additionalProperties: false,
    },
  },
] as const;

export async function handleMcp(c: Context<AppEnv>): Promise<Response> {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: mcpHeaders() });
  }
  if (c.req.method === "GET") {
    return jsonResponse(
      {
        error: "method_not_allowed",
        message: "POST JSON-RPC messages to this endpoint. The server card is at /.well-known/mcp/server-card.json.",
      },
      405,
    );
  }
  if (c.req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const text = await c.req.text();
  if (text.length > MAX_BODY) {
    return rpcError(null, -32700, "Request body is too large", 413);
  }
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  if (Array.isArray(parsed)) {
    const results = [];
    for (const item of parsed) {
      const result = await dispatch(c, item);
      if (result) results.push(result);
    }
    if (results.length === 0) return new Response(null, { status: 202, headers: mcpHeaders() });
    return jsonResponse(results, 200);
  }
  const result = await dispatch(c, parsed);
  if (!result) return new Response(null, { status: 202, headers: mcpHeaders() });
  const status = typeof result === "object" && result && "error" in result ? 400 : 200;
  return jsonResponse(result, status);
}

async function dispatch(c: Context<AppEnv>, message: unknown): Promise<Record<string, unknown> | null> {
  if (!message || typeof message !== "object") {
    return rpcBody(null, undefined, { code: -32600, message: "Invalid Request" });
  }
  const rpc = message as RpcMessage;
  const id = Object.prototype.hasOwnProperty.call(rpc, "id") ? (rpc.id ?? null) : undefined;
  if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
    return rpcBody(id ?? null, undefined, { code: -32600, message: "Invalid Request" });
  }
  if (id === undefined) {
    return null;
  }
  if (rpc.method === "initialize") {
    const requested = protocolVersion(rpc.params);
    return rpcBody(id, {
      protocolVersion: requested,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions:
        "OCLaunch MCP exposes public discovery only. Private workspace changes require a human passkey session.",
    });
  }
  if (rpc.method === "ping") return rpcBody(id, {});
  if (rpc.method === "tools/list") return rpcBody(id, { tools: TOOLS });
  if (rpc.method === "resources/list") return rpcBody(id, { resources: [] });
  if (rpc.method === "prompts/list") return rpcBody(id, { prompts: [] });
  if (rpc.method === "tools/call") return rpcBody(id, await callTool(c, rpc.params));
  return rpcBody(id, undefined, { code: -32601, message: "Method not found" });
}

function protocolVersion(params: unknown): string {
  const requested =
    params && typeof params === "object" && "protocolVersion" in params
      ? String((params as { protocolVersion?: unknown }).protocolVersion ?? "")
      : "";
  if (requested === "2024-11-05" || requested === "2025-03-26" || requested === PROTOCOL_VERSION) {
    return requested;
  }
  return PROTOCOL_VERSION;
}

async function callTool(c: Context<AppEnv>, params: unknown) {
  const name =
    params && typeof params === "object" && "name" in params
      ? String((params as { name?: unknown }).name ?? "")
      : "";
  const args =
    params && typeof params === "object" && "arguments" in params
      ? (params as { arguments?: unknown }).arguments
      : {};
  const record = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
  try {
    if (name === "describe_oclaunch") {
      return toolText(
        "OCLaunch helps solo founders capture a release, collect a focused review, export a fix note, and record what improved. Public tools can read health, Discover, and product passports. Creating a project requires a person to sign in with a passkey.",
      );
    }
    if (name === "get_health") {
      return toolText(
        JSON.stringify({
          ok: true,
          service: "oclaunch-platform",
          env: c.env.APP_ENV,
          ruleset: c.env.RULESET_VERSION,
        }),
      );
    }
    if (name === "list_public_projects") {
      const rows = await c.env.DB.prepare(
        `SELECT p.slug, p.name, p.description, p.purpose, p.audience, p.category, p.live_url
         FROM projects p
         WHERE p.visibility = 'public'
         ORDER BY p.updated_at DESC
         LIMIT 25`,
      ).all();
      return toolText(JSON.stringify({ projects: rows.results ?? [] }));
    }
    if (name === "get_product_passport") {
      const slug = String(record.slug ?? "").trim();
      if (!slug) return toolText("slug is required", true);
      const project = await c.env.DB.prepare(
        `SELECT slug, name, description, purpose, audience, primary_task, live_url, category, visibility
         FROM projects WHERE slug = ? AND visibility IN ('public','unlisted')`,
      )
        .bind(slug)
        .first();
      if (!project) return toolText("Project not found", true);
      return toolText(JSON.stringify(project));
    }
    return toolText(`Unknown tool: ${name}`, true);
  } catch {
    return toolText("The tool could not read OCLaunch data.", true);
  }
}

function toolText(text: string, isError = false) {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

function rpcBody(
  id: RpcId | undefined,
  result: unknown,
  error?: { code: number; message: string },
): Record<string, unknown> {
  if (error) {
    return { jsonrpc: "2.0", id: id ?? null, error };
  }
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: RpcId, code: number, message: string, status: number): Response {
  return jsonResponse(rpcBody(id, undefined, { code, message }), status);
}

function jsonResponse(body: unknown, status: number): Response {
  const headers = mcpHeaders();
  if (status === 405) headers.set("Allow", "POST, OPTIONS");
  return new Response(JSON.stringify(body), { status, headers });
}

function mcpHeaders(): Headers {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, MCP-Protocol-Version");
  headers.set("MCP-Protocol-Version", PROTOCOL_VERSION);
  headers.set("Cache-Control", "no-store");
  return headers;
}
