import { assessOutboundUrl, type ResolveHost } from "../lib/fetch-guard.js";

export type CheckFinding = {
  provenance: "deterministic_check";
  category: string;
  severity: "blocker" | "high" | "medium" | "low";
  confidence: "low" | "medium" | "high";
  title: string;
  body: string;
  acceptanceCriterion?: string;
};

export type CheckOptions = {
  allowLoopback?: boolean;
  resolve?: ResolveHost;
};

function finding(
  title: string,
  body: string,
  severity: CheckFinding["severity"],
  category = "Release presentation",
  confidence: CheckFinding["confidence"] = "high",
  acceptanceCriterion = "Use a public https URL with no embedded credentials.",
): CheckFinding {
  return {
    provenance: "deterministic_check",
    category,
    severity,
    confidence,
    title,
    body,
    acceptanceCriterion,
  };
}

/** Bounded, non-browser checks safe to run from the Worker. */
export async function runDeterministicChecks(
  sourceUrl: string,
  opts?: CheckOptions,
): Promise<CheckFinding[]> {
  const decision = await assessOutboundUrl(sourceUrl, {
    allowLoopback: opts?.allowLoopback,
    resolve: opts?.resolve,
  });
  if (!decision.ok) {
    if (decision.reason === "credentials") {
      return [
        finding(
          "Release URL must not include credentials",
          "Embedded usernames or passwords are not stored or fetched.",
          "blocker",
        ),
      ];
    }
    if (decision.reason === "host") {
      return [
        finding(
          "Release host is blocked for automated fetch",
          "Private, loopback, link-local, or metadata hosts are not fetched.",
          "blocker",
        ),
      ];
    }
    if (decision.reason === "dns") {
      return [
        finding(
          "Release host could not be checked",
          "The hostname did not resolve to a public address, so it was not fetched.",
          "blocker",
        ),
      ];
    }
    return [
      finding(
        "Release source URL is not a valid absolute URL",
        "Provide a valid https URL for the release snapshot.",
        "blocker",
      ),
    ];
  }

  const findings: CheckFinding[] = [];
  try {
    const res = await fetch(decision.url.toString(), {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "OCLaunch-DeterministicCheck/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status >= 300 && res.status < 400) {
      findings.push(
        finding(
          "Release URL redirected and was not followed",
          "Redirects are not followed. Publish the release on the URL itself.",
          "high",
          "First-use experience",
          "high",
          "Primary release URL responds directly without a redirect.",
        ),
      );
      return findings;
    }
    const ct = res.headers.get("content-type") ?? "";
    if (res.status >= 400) {
      findings.push(
        finding(
          `Release URL returned HTTP ${res.status}`,
          "The release URL did not return a successful response.",
          "high",
          "First-use experience",
          "high",
          "Primary release URL returns a successful response for anonymous visitors.",
        ),
      );
    }
    if (ct.includes("text/html") && res.status < 400) {
      const html = (await res.text()).slice(0, 200_000);
      if (!/<title[^>]*>\s*\S+/i.test(html)) {
        findings.push(
        finding(
          "Document title appears missing",
          "No non-empty title was found in the first HTML response chunk.",
          "medium",
          "Clarity",
          "medium",
          "Page includes a descriptive title element.",
        ),
        );
      }
      if (!/meta\s+name=["']description["']/i.test(html)) {
        findings.push(
        finding(
          "Meta description not detected",
          "No meta description tag was found in the HTML head sample.",
          "low",
          "Release presentation",
          "medium",
          "Add a concise meta description for link previews.",
        ),
        );
      }
      if (!/rel=["']icon["']/i.test(html) && !/rel=["']shortcut icon["']/i.test(html)) {
        findings.push(
        finding(
          "Favicon link not detected",
          "No favicon link relation was found in the HTML sample.",
          "low",
          "Visual consistency",
          "low",
          "Document links a favicon for browser tabs.",
        ),
        );
      }
    }
  } catch {
    findings.push(
        finding(
          "Could not fetch release URL",
          "The release URL could not be fetched.",
          "high",
          "First-use experience",
          "medium",
          "Primary release URL is reachable from the public internet.",
        ),
    );
  }
  return findings;
}
