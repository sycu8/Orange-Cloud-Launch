/**
 * Public agent-discovery documents.
 * Origins follow the request host so localhost, staging, and production
 * advertise themselves. Private workspace APIs stay on passkey sessions.
 */

export const SERVER_NAME = "oclaunch";
export const SERVER_VERSION = "0.1.0";

export const API_CATALOG_PROFILE = "https://www.rfc-editor.org/info/rfc9727";
export const SKILLS_SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";

/** RFC 8288 Link header for the homepage. Relative targets resolve on this host. */
export const HOMEPAGE_LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"',
  '</docs/api>; rel="service-doc"; type="text/html"',
  '</.well-known/ai-catalog.json>; rel="describedby"; type="application/json"',
].join(", ");

export const REVIEW_SKILL_NAME = "review-a-release";
export const REVIEW_SKILL_DESCRIPTION =
  "Capture an OCLaunch release, collect a focused review of one user task, and export a fix note for the person or coding agent shipping the product.";

export const API_SKILL_NAME = "read-public-api";
export const API_SKILL_DESCRIPTION =
  "Read OCLaunch discovery documents and call the unauthenticated health, Discover, and product passport endpoints.";

export const REVIEW_SKILL_MD = `---
name: ${REVIEW_SKILL_NAME}
description: ${REVIEW_SKILL_DESCRIPTION}
---

# Review a release

Use this skill when a founder wants feedback on a web app before the next release.

## Loop

1. Sign a person in with a passkey at \`/signin\`. OCLaunch does not issue an OAuth bearer token for the private workspace.
2. Add a project at \`/app/new\`. New projects are private.
3. Capture the release URL. Automated checks do not bypass bot protection.
4. Ask a reviewer to complete the primary user task. Owners cannot review their own project.
5. Accept the findings that should be fixed and copy the fix note from the improvement studio.
6. Verify what changed and write the release report.

## Public reads

These GET endpoints need no credential:

- \`/api/health\`
- \`/api/discover\`
- \`/p/{slug}\` for a public or unlisted passport

Discovery documents live at \`/.well-known/api-catalog\`, \`/openapi.json\`, \`/docs/api\`, and \`/auth.md\`.
`;

export const API_SKILL_MD = `---
name: ${API_SKILL_NAME}
description: ${API_SKILL_DESCRIPTION}
---

# Read the public API

Use this skill to discover OCLaunch without guessing paths.

## Start here

1. \`GET /.well-known/api-catalog\` (\`application/linkset+json\`) lists the API anchor, OpenAPI document, human docs, and health URL.
2. \`GET /openapi.json\` is the machine-readable description.
3. \`GET /docs/api\` is the human description.
4. \`GET /auth.md\` explains registration. Public reads use no credential. Private routes need a passkey session.

## Calls

- \`GET /api/health\` returns \`{ "ok": true, "service": "oclaunch-platform" }\`.
- \`GET /api/discover\` lists public projects.
- \`GET /p/{slug}\` returns a public or unlisted product passport. Unknown slugs return 404.

Do not send \`Authorization\` on these routes. A 401 from \`/api/projects\` or other workspace routes means the caller needs a browser passkey session, not a bearer token.
`;

const SKILLS: Record<string, { description: string; body: string }> = {
  [REVIEW_SKILL_NAME]: { description: REVIEW_SKILL_DESCRIPTION, body: REVIEW_SKILL_MD },
  [API_SKILL_NAME]: { description: API_SKILL_DESCRIPTION, body: API_SKILL_MD },
};

export function skillMarkdown(name: string): string | null {
  return SKILLS[name]?.body ?? null;
}

export async function sha256Prefixed(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

export function requestOrigin(requestUrl: string): string {
  return new URL(requestUrl).origin;
}

export function apiCatalog(origin: string) {
  return {
    linkset: [
      {
        anchor: `${origin}/api`,
        "service-desc": [
          {
            href: `${origin}/openapi.json`,
            type: "application/vnd.oai.openapi+json",
          },
        ],
        "service-doc": [
          {
            href: `${origin}/docs/api`,
            type: "text/html",
          },
        ],
        status: [
          {
            href: `${origin}/api/health`,
            type: "application/json",
          },
        ],
      },
    ],
  };
}

export function openApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "OCLaunch API",
      version: SERVER_VERSION,
      summary: "Community review-to-improvement workspace for solo founders.",
      description:
        "Public reads need no credential. Creating projects, reviews, and reports requires a passkey session cookie from /signin. OCLaunch does not issue OAuth access tokens for the private workspace. See /auth.md.",
    },
    servers: [{ url: origin }],
    tags: [
      { name: "public", description: "Unauthenticated reads" },
      { name: "auth", description: "Passkey session" },
    ],
    paths: {
      "/api/health": {
        get: {
          tags: ["public"],
          operationId: "getHealth",
          summary: "Service health",
          responses: {
            "200": {
              description: "Service is up",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok", "service"],
                    properties: {
                      ok: { type: "boolean" },
                      service: { type: "string" },
                      env: { type: "string" },
                      ruleset: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/discover": {
        get: {
          tags: ["public"],
          operationId: "listPublicProjects",
          summary: "List public projects on Discover",
          responses: {
            "200": {
              description: "Public projects",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/p/{slug}": {
        get: {
          tags: ["public"],
          operationId: "getProductPassport",
          summary: "Public or unlisted product passport",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Passport HTML or JSON when Accept is application/json" },
            "404": { description: "Unknown or private project" },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["auth"],
          operationId: "getSession",
          summary: "Current passkey session",
          responses: {
            "200": { description: "Signed-in user" },
            "401": { description: "No session. Sign in with a passkey." },
          },
        },
      },
      "/api/auth/passkey/register/options": {
        post: {
          tags: ["auth"],
          operationId: "passkeyRegisterOptions",
          summary: "Start passkey registration",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["displayName"],
                  properties: { displayName: { type: "string", maxLength: 80 } },
                },
              },
            },
          },
          responses: {
            "200": { description: "WebAuthn creation options" },
          },
        },
      },
      "/api/auth/passkey/login/options": {
        post: {
          tags: ["auth"],
          operationId: "passkeyLoginOptions",
          summary: "Start passkey sign-in",
          responses: {
            "200": { description: "WebAuthn request options" },
          },
        },
      },
    },
  };
}

export function apiDocsHtml(origin: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OCLaunch API</title>
  <link rel="api-catalog" href="${origin}/.well-known/api-catalog" type="application/linkset+json" />
  <link rel="service-desc" href="${origin}/openapi.json" type="application/vnd.oai.openapi+json" />
</head>
<body>
  <main>
    <h1>OCLaunch API</h1>
    <p>OCLaunch is the community launch workspace at ${origin}. Public reads need no credential. Private workspace routes require a passkey session from <a href="${origin}/signin">/signin</a>.</p>
    <h2>Discovery</h2>
    <ul>
      <li><a href="${origin}/.well-known/api-catalog">API catalog</a> (application/linkset+json)</li>
      <li><a href="${origin}/openapi.json">OpenAPI document</a></li>
      <li><a href="${origin}/auth.md">Auth.md</a></li>
      <li><a href="${origin}/api/health">Health</a></li>
    </ul>
    <h2>Public endpoints</h2>
    <ul>
      <li><code>GET /api/health</code> — service status.</li>
      <li><code>GET /api/discover</code> — public projects.</li>
      <li><code>GET /p/{slug}</code> — public or unlisted product passport.</li>
    </ul>
    <h2>Authentication</h2>
    <p>Founders register and sign in with a passkey. The session is an HTTP cookie. Agents calling public endpoints must not send an Authorization header. See <a href="${origin}/auth.md">Auth.md</a> and <a href="${origin}/.well-known/oauth-protected-resource">protected resource metadata</a>.</p>
  </main>
</body>
</html>
`;
}

export function oauthAuthorizationServer(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    registration_endpoint: `${origin}/agent/register`,
    scopes_supported: ["public:read"],
    response_types_supported: [] as string[],
    grant_types_supported: [] as string[],
    token_endpoint_auth_methods_supported: ["none"],
    service_documentation: `${origin}/docs/api`,
    agent_auth: agentAuth(origin),
  };
}

export function openIdConfiguration(origin: string) {
  return {
    ...oauthAuthorizationServer(origin),
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: [] as string[],
  };
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api`,
    resource_name: "OCLaunch API",
    authorization_servers: [origin],
    scopes_supported: ["public:read"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/docs/api`,
  };
}

export function agentAuth(origin: string) {
  return {
    skill: `${origin}/auth.md`,
    register_uri: `${origin}/agent/register`,
    identity_endpoint: `${origin}/agent/register`,
    claim_uri: `${origin}/agent/claim`,
    claim_endpoint: `${origin}/agent/claim`,
    identity_types_supported: ["anonymous"],
    anonymous: {
      credential_types_supported: ["none"],
      claim_uri: `${origin}/agent/claim`,
    },
  };
}

export function authMarkdown(origin: string): string {
  return `# Auth.md

OCLaunch agent registration for ${origin}.

## Audience

Agents reading public project passports, and agents helping a person who already has an OCLaunch passkey. OCLaunch does not create accounts or issue bearer tokens from this file.

## Protected resource

Fetch \`/.well-known/oauth-protected-resource\`.

- \`resource\` is \`${origin}/api\`.
- \`authorization_servers\` lists \`${origin}\`, the same issuer as \`/.well-known/oauth-authorization-server\`.
- \`scopes_supported\` includes \`public:read\`.
- \`bearer_methods_supported\` includes \`header\`. Public reads do not use that header. Workspace routes answer 401 with \`WWW-Authenticate\` pointing at the protected resource metadata, then still require a passkey session rather than a bearer token.

## Authorization server

Fetch \`/.well-known/oauth-authorization-server\` (the same fields are also at \`/.well-known/openid-configuration\`).

The \`agent_auth\` block contains:

- \`skill\`: this document
- \`register_uri\`: \`${origin}/agent/register\`
- \`identity_types_supported\`: \`anonymous\`
- \`anonymous.credential_types_supported\`: \`none\`
- \`anonymous.claim_uri\`: \`${origin}/agent/claim\`

\`issuer\` is \`${origin}\`. \`jwks_uri\` publishes an empty key set because OCLaunch does not sign access tokens.

## Anonymous registration

\`POST /agent/register\` with \`{"type":"anonymous"}\`.

The response confirms credential type \`none\`. No account is created and no secret is returned. Call the public endpoints directly.

## Claim

\`POST /agent/claim\` repeats the public URLs an anonymous agent may call: \`/api/health\`, \`/api/discover\`, and \`/p/{slug}\`.

## Passkeys for the private workspace

A person creates a passkey at \`/signin\`. That session cookie is what \`/api/projects\`, reviews, improvements, and reports accept. \`GET /oauth/authorize\` and \`POST /oauth/token\` explain this and do not issue grants. There is no ID-JAG, verified-email, or anonymous secret flow.

## Revocation

The signed-in browser revokes its session with \`POST /api/auth/logout\`. There is no bearer token to revoke and no revocation URL for anonymous public access.
`;
}

export function anonymousRegistration(origin: string) {
  return {
    identity_type: "anonymous",
    credential_type: "none",
    token_required: false,
    scopes: ["public:read"],
    register_uri: `${origin}/agent/register`,
    claim_uri: `${origin}/agent/claim`,
    message:
      "Public OCLaunch resources do not require a credential. This endpoint does not create an account or issue a secret. Private workspace APIs require a human passkey session at /signin.",
  };
}

export function anonymousClaim(origin: string) {
  return {
    ...anonymousRegistration(origin),
    endpoints: [`${origin}/api/health`, `${origin}/api/discover`, `${origin}/p/{slug}`],
  };
}

export function mcpServerCard(origin: string) {
  return {
    serverInfo: {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      title: "OCLaunch",
    },
    description:
      "Public discovery tools for OCLaunch: health, Discover listings, and product passports. Private workspace actions stay on passkey sessions.",
    transport: {
      type: "streamable-http",
      endpoint: "/mcp",
      url: `${origin}/mcp`,
    },
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false },
      prompts: { listChanged: false },
    },
    authentication: {
      required: false,
      schemes: [] as string[],
    },
    documentationUrl: `${origin}/docs/api`,
  };
}

export async function agentSkillsIndex(origin: string) {
  const skills = await Promise.all(
    Object.entries(SKILLS).map(async ([name, skill]) => ({
      name,
      type: "skill-md" as const,
      description: skill.description,
      url: `${origin}/.well-known/agent-skills/${name}/SKILL.md`,
      digest: await sha256Prefixed(skill.body),
    })),
  );
  return {
    $schema: SKILLS_SCHEMA,
    skills,
  };
}

export function aiCatalog(origin: string) {
  const hostname = new URL(origin).hostname;
  const entry = (
    namespace: string,
    name: string,
    displayName: string,
    type: string,
    url: string,
    representativeQueries: string[],
  ) => ({
    identifier: `urn:air:${hostname}:${namespace}:${name}`,
    displayName,
    type,
    url,
    representativeQueries,
  });
  return {
    specVersion: "1.0",
    host: {
      displayName: "OCLaunch",
      identifier: `did:web:${hostname}`,
    },
    entries: [
      entry(
        "server",
        "oclaunch",
        "OCLaunch MCP server",
        "application/mcp-server-card+json",
        `${origin}/.well-known/mcp/server-card.json`,
        [
          "what public projects are on OCLaunch Discover",
          "is the OCLaunch API healthy",
          "show the MCP tools for OCLaunch",
        ],
      ),
      entry(
        "api",
        "platform",
        "OCLaunch API catalog",
        "application/linkset+json",
        `${origin}/.well-known/api-catalog`,
        [
          "where is the OCLaunch OpenAPI document",
          "what is the health endpoint for OCLaunch",
          "how do I find the OCLaunch API documentation",
        ],
      ),
      entry(
        "skills",
        "index",
        "OCLaunch agent skills",
        "text/markdown",
        `${origin}/.well-known/agent-skills/index.json`,
        [
          "how should an agent review an OCLaunch release",
          "which OCLaunch endpoints can I call without a credential",
        ],
      ),
      entry(
        "auth",
        "registration",
        "OCLaunch Auth.md",
        "text/markdown",
        `${origin}/auth.md`,
        [
          "how does an agent register with OCLaunch",
          "does OCLaunch issue an OAuth access token",
          "how do founders sign in to OCLaunch",
        ],
      ),
    ],
  };
}
