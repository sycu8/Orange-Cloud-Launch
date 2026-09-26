import { DEFAULT_QUOTAS } from "@oclaunch/shared";
import { assessOutboundUrl, type ResolveHost } from "../lib/fetch-guard.js";

/** Desktop + phone viewports fixed by the report contract. */
export const AUTOMATED_VIEWPORTS = [
  { width: 1280, height: 800, label: "1280x800" },
  { width: 390, height: 844, label: "390x844" },
] as const;

export type BrowserFinding = {
  provenance: "browser_observation";
  category: string;
  severity: "blocker" | "high" | "medium" | "low";
  confidence: "low" | "medium" | "high";
  title: string;
  body: string;
  acceptanceCriterion?: string;
  /** Optional capture index this finding is evidenced by. */
  captureIndex?: number;
};

export type BrowserCapture = {
  route: string;
  viewportLabel: string;
  width: number;
  height: number;
  mimeType: "image/png";
  bytes: Uint8Array;
  pageTitle?: string;
  markdownExcerpt?: string;
};

export type BrowserReviewResult = {
  status: "skipped" | "integration_not_configured" | "completed" | "failed";
  message: string;
  sourceUrl: string;
  routesVisited: string[];
  viewports: string[];
  captures: BrowserCapture[];
  findings: BrowserFinding[];
};

/** Minimal Browser Run binding surface used by this adapter. */
export type BrowserRunBinding = {
  quickAction(
    action: string,
    options: Record<string, unknown>,
  ): Promise<unknown>;
};

export type BrowserEnv = {
  ENABLE_BROWSER_RUN: string;
  BROWSER?: BrowserRunBinding;
};

export type BrowserOptions = {
  allowLoopback?: boolean;
  resolve?: ResolveHost;
  /** Injected for unit tests — bypasses env.BROWSER.quickAction. */
  runner?: BrowserQuickActionRunner;
};

export type BrowserQuickActionRunner = (
  action: string,
  options: Record<string, unknown>,
) => Promise<unknown>;

type A11yNode = {
  role?: string;
  name?: string;
  level?: number;
  children?: A11yNode[];
};

type SnapshotPayload = {
  screenshot?: string | Uint8Array | ArrayBuffer;
  content?: string;
  markdown?: string;
  accessibilityTree?: A11yNode;
  meta?: { status?: number; title?: string };
  title?: string;
};

function finding(
  partial: Omit<BrowserFinding, "provenance">,
): BrowserFinding {
  return { provenance: "browser_observation", ...partial };
}

function decodeBase64(b64: string): Uint8Array {
  const cleaned = b64.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function asBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === "string" && value.length > 0) {
    try {
      return decodeBase64(value);
    } catch {
      return null;
    }
  }
  return null;
}

async function coercePayload(raw: unknown): Promise<unknown> {
  if (raw == null) return null;
  if (typeof Response !== "undefined" && raw instanceof Response) {
    const ct = raw.headers.get("content-type") ?? "";
    if (ct.includes("application/json") || ct.includes("+json")) {
      return raw.json();
    }
    if (ct.startsWith("image/")) {
      return { screenshot: new Uint8Array(await raw.arrayBuffer()) };
    }
    const text = await raw.text();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { content: text };
    }
  }
  return raw;
}

function unwrapResult(payload: unknown): SnapshotPayload {
  if (!payload || typeof payload !== "object") return {};
  const obj = payload as Record<string, unknown>;
  if (obj.result && typeof obj.result === "object") {
    return obj.result as SnapshotPayload;
  }
  return obj as SnapshotPayload;
}

function collectLinkUrls(payload: unknown): string[] {
  const unwrapped = unwrapResult(payload) as Record<string, unknown>;
  const candidates: unknown[] = [];
  if (Array.isArray(unwrapped)) candidates.push(...unwrapped);
  if (Array.isArray(unwrapped.links)) candidates.push(...unwrapped.links);
  if (Array.isArray(unwrapped.result)) candidates.push(...(unwrapped.result as unknown[]));

  const urls: string[] = [];
  for (const item of candidates) {
    if (typeof item === "string") {
      urls.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const href = row.url ?? row.href ?? row.link;
      if (typeof href === "string") urls.push(href);
    }
  }
  return urls;
}

function walkA11y(
  node: A11yNode | undefined,
  visit: (n: A11yNode) => void,
): void {
  if (!node) return;
  visit(node);
  for (const child of node.children ?? []) walkA11y(child, visit);
}

function sameOriginPath(base: URL, href: string): string | null {
  let next: URL;
  try {
    next = new URL(href, base);
  } catch {
    return null;
  }
  if (next.origin !== base.origin) return null;
  if (next.protocol !== "https:" && next.protocol !== "http:") return null;
  if (next.username || next.password) return null;
  // Prefer path-only navigations (no mailto/hash-only).
  if (next.hash && !next.pathname) return null;
  const path = `${next.pathname}${next.search}` || "/";
  if (path.startsWith("/api/") || path.startsWith("/cdn-cgi/")) return null;
  return path;
}

/** Pick up to `limit` same-origin routes a curious human might open next. */
export function selectHumanTesterRoutes(
  sourceUrl: string,
  discoveredHrefs: string[],
  limit = DEFAULT_QUOTAS.routesPerAutomatedReview,
): string[] {
  const base = new URL(sourceUrl);
  const primary = `${base.pathname}${base.search}` || "/";
  const routes: string[] = [primary === "" ? "/" : primary];
  const seen = new Set(routes);

  const scored = discoveredHrefs
    .map((href) => {
      const path = sameOriginPath(base, href);
      if (!path || seen.has(path)) return null;
      // Prefer short top-nav style paths over deep IDs.
      const depth = path.split("/").filter(Boolean).length;
      const score = depth + (path.includes("?") ? 2 : 0) + path.length / 200;
      return { path, score };
    })
    .filter((row): row is { path: string; score: number } => Boolean(row))
    .sort((a, b) => a.score - b.score);

  for (const row of scored) {
    if (routes.length >= limit) break;
    if (seen.has(row.path)) continue;
    seen.add(row.path);
    routes.push(row.path);
  }
  return routes.slice(0, limit);
}

function absoluteRouteUrl(sourceUrl: string, route: string): string {
  return new URL(route, sourceUrl).toString();
}

/** Derive concrete observations from a rendered snapshot — never human_observation. */
export function discoverFromSnapshot(input: {
  route: string;
  viewportLabel: string;
  captureIndex: number;
  markdown?: string;
  accessibilityTree?: A11yNode;
  pageTitle?: string;
  httpStatus?: number;
}): BrowserFinding[] {
  const findings: BrowserFinding[] = [];
  const md = (input.markdown ?? "").trim();
  const title = (input.pageTitle ?? "").trim();
  const routeLabel = `${input.route} @ ${input.viewportLabel}`;

  if (input.httpStatus != null && input.httpStatus >= 400) {
    findings.push(
      finding({
        category: "First-use experience",
        severity: input.httpStatus >= 500 ? "high" : "medium",
        confidence: "high",
        title: `Browser Run saw HTTP ${input.httpStatus} on ${routeLabel}`,
        body: `A Chromium human-tester session loaded this route and received status ${input.httpStatus}. This is a browser observation, not a human review outcome.`,
        acceptanceCriterion: "Primary release routes return a successful response for anonymous visitors.",
        captureIndex: input.captureIndex,
      }),
    );
  }

  if (/404|not found|page missing/i.test(`${title}\n${md.slice(0, 400)}`)) {
    findings.push(
      finding({
        category: "First-use experience",
        severity: "medium",
        confidence: "medium",
        title: `Possible missing page at ${routeLabel}`,
        body: "Rendered title or content looks like a not-found page during Browser Run discovery.",
        acceptanceCriterion: "Navigable routes resolve to real product content.",
        captureIndex: input.captureIndex,
      }),
    );
  }

  if (!title) {
    findings.push(
      finding({
        category: "Clarity",
        severity: "medium",
        confidence: "medium",
        title: `Document title empty after render (${routeLabel})`,
        body: "Browser Run finished loading the page but no document title was present. Deterministic HTML fetch notes are separate; this is a rendered viewport observation.",
        acceptanceCriterion: "Page includes a descriptive title after client render.",
        captureIndex: input.captureIndex,
      }),
    );
  }

  let headingCount = 0;
  let mainLandmark = false;
  let interactive = 0;
  walkA11y(input.accessibilityTree, (node) => {
    const role = (node.role ?? "").toLowerCase();
    if (role === "heading" || (typeof node.level === "number" && node.level >= 1)) {
      headingCount += 1;
    }
    if (role === "main") mainLandmark = true;
    if (
      role === "link" ||
      role === "button" ||
      role === "textbox" ||
      role === "searchbox" ||
      role === "combobox"
    ) {
      interactive += 1;
    }
  });

  if (input.accessibilityTree && headingCount === 0) {
    findings.push(
      finding({
        category: "Accessibility",
        severity: "medium",
        confidence: "medium",
        title: `No headings in accessibility tree (${routeLabel})`,
        body: "The Browser Run accessibility snapshot had no heading roles. A human tester would struggle to scan the page structure.",
        acceptanceCriterion: "Page exposes a clear heading hierarchy.",
        captureIndex: input.captureIndex,
      }),
    );
  }

  if (input.accessibilityTree && !mainLandmark && input.viewportLabel.startsWith("1280")) {
    findings.push(
      finding({
        category: "Accessibility",
        severity: "low",
        confidence: "low",
        title: `Main landmark not detected (${routeLabel})`,
        body: "Accessibility tree from Browser Run did not include a main landmark on the desktop viewport.",
        acceptanceCriterion: "Document exposes a main landmark for assistive tech.",
        captureIndex: input.captureIndex,
      }),
    );
  }

  if (md.length > 0 && md.length < 40 && interactive === 0) {
    findings.push(
      finding({
        category: "First-use experience",
        severity: "high",
        confidence: "medium",
        title: `Near-empty first paint (${routeLabel})`,
        body: "Browser Run captured very little readable content and no interactive controls after waiting for network idle. Treat as a first-use risk, not a readiness score.",
        acceptanceCriterion: "Anonymous visitors see meaningful content and a clear next action.",
        captureIndex: input.captureIndex,
      }),
    );
  }

  if (input.viewportLabel.startsWith("390") && interactive === 0 && md.length > 80) {
    findings.push(
      finding({
        category: "First-use experience",
        severity: "medium",
        confidence: "low",
        title: `No tappable controls at phone width (${routeLabel})`,
        body: "At ~390px, Browser Run's accessibility tree listed content but no links/buttons. A human on a phone may not find a next step.",
        acceptanceCriterion: "Primary task controls remain reachable at phone width.",
        captureIndex: input.captureIndex,
      }),
    );
  }

  return findings;
}

async function runQuickAction(
  env: BrowserEnv,
  opts: BrowserOptions | undefined,
  action: string,
  options: Record<string, unknown>,
): Promise<unknown> {
  if (opts?.runner) return opts.runner(action, options);
  if (!env.BROWSER?.quickAction) {
    throw new Error("browser_binding_missing");
  }
  return env.BROWSER.quickAction(action, options);
}

async function captureSnapshot(
  env: BrowserEnv,
  opts: BrowserOptions | undefined,
  url: string,
  viewport: (typeof AUTOMATED_VIEWPORTS)[number],
): Promise<{ payload: SnapshotPayload; bytes: Uint8Array | null }> {
  const raw = await runQuickAction(env, opts, "snapshot", {
    url,
    formats: ["screenshot", "markdown", "accessibilityTree"],
    viewport: { width: viewport.width, height: viewport.height },
    gotoOptions: { waitUntil: "networkidle2", timeout: 30_000 },
    // Identify as a product tester session, not a silent scraper.
    userAgent:
      "Mozilla/5.0 (compatible; OCLaunch-HumanTester/1.0; +https://launch.orangecloud.vn) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  });
  const payload = unwrapResult(await coercePayload(raw));
  const bytes = asBytes(payload.screenshot);
  return { payload, bytes };
}

/**
 * Browser Run human-tester: open the release like a curious visitor, capture
 * evidence-based viewport snapshots, and record browser_observation findings.
 * Never labels results as human_observation — those stay reserved for people.
 */
export async function runBrowserReview(
  env: BrowserEnv,
  sourceUrl: string,
  opts?: BrowserOptions,
): Promise<BrowserReviewResult> {
  const empty = {
    sourceUrl,
    routesVisited: [] as string[],
    viewports: AUTOMATED_VIEWPORTS.map((v) => v.label),
    captures: [] as BrowserCapture[],
    findings: [] as BrowserFinding[],
  };

  if (env.ENABLE_BROWSER_RUN !== "true") {
    return {
      ...empty,
      status: "integration_not_configured",
      message:
        "Browser Run is disabled. Deterministic checks still ran. Set ENABLE_BROWSER_RUN=true and bind Browser Run (BROWSER) to capture human-tester viewports.",
    };
  }

  if (!opts?.runner && !env.BROWSER?.quickAction) {
    return {
      ...empty,
      status: "integration_not_configured",
      message:
        "Browser Run binding is not provisioned in this environment. No screenshots were claimed.",
    };
  }

  const decision = await assessOutboundUrl(sourceUrl, {
    allowLoopback: opts?.allowLoopback,
    resolve: opts?.resolve,
  });
  if (!decision.ok) {
    return {
      ...empty,
      status: "skipped",
      message: "Release URL was not opened in Browser Run (blocked or invalid).",
    };
  }

  const baseUrl = decision.url.toString();
  const viewports = AUTOMATED_VIEWPORTS.slice(0, DEFAULT_QUOTAS.viewportsPerAutomatedReview);

  try {
    let discovered: string[] = [];
    try {
      const linksRaw = await runQuickAction(env, opts, "links", {
        url: baseUrl,
        gotoOptions: { waitUntil: "networkidle2", timeout: 30_000 },
      });
      discovered = collectLinkUrls(await coercePayload(linksRaw));
    } catch {
      discovered = [];
    }

    const routes = selectHumanTesterRoutes(
      baseUrl,
      discovered,
      DEFAULT_QUOTAS.routesPerAutomatedReview,
    );

    const captures: BrowserCapture[] = [];
    const findings: BrowserFinding[] = [];

    for (const route of routes) {
      const absolute = absoluteRouteUrl(baseUrl, route);
      for (const viewport of viewports) {
        const { payload, bytes } = await captureSnapshot(env, opts, absolute, viewport);
        if (!bytes || bytes.length < 32) {
          findings.push(
            finding({
              category: "Release presentation",
              severity: "medium",
              confidence: "medium",
              title: `Viewport capture failed (${route} @ ${viewport.label})`,
              body: "Browser Run did not return a usable screenshot for this human-tester viewport.",
              acceptanceCriterion: "Release URL renders a captureable page in Chromium.",
            }),
          );
          continue;
        }

        const captureIndex = captures.length;
        const pageTitle =
          payload.meta?.title ??
          payload.title ??
          (typeof payload.markdown === "string"
            ? payload.markdown.split("\n").find((line) => line.startsWith("# "))?.replace(/^#\s+/, "")
            : undefined);

        captures.push({
          route,
          viewportLabel: viewport.label,
          width: viewport.width,
          height: viewport.height,
          mimeType: "image/png",
          bytes,
          pageTitle,
          markdownExcerpt: payload.markdown?.slice(0, 2_000),
        });

        findings.push(
          ...discoverFromSnapshot({
            route,
            viewportLabel: viewport.label,
            captureIndex,
            markdown: payload.markdown,
            accessibilityTree: payload.accessibilityTree,
            pageTitle,
            httpStatus: payload.meta?.status,
          }),
        );
      }
    }

    return {
      status: "completed",
      message:
        captures.length > 0
          ? `Human-tester Browser Run captured ${captures.length} viewport snapshot(s) across ${routes.length} route(s). Observations are not human review outcomes.`
          : "Browser Run finished without usable screenshots.",
      sourceUrl: baseUrl,
      routesVisited: routes,
      viewports: viewports.map((v) => v.label),
      captures,
      findings,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : "browser_run_failed";
    return {
      ...empty,
      status: "failed",
      message: `Browser Run human-tester failed: ${detail}`,
    };
  }
}
