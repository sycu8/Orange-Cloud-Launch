export type CheckFinding = {
  provenance: "deterministic_check";
  category: string;
  severity: "blocker" | "high" | "medium" | "low";
  confidence: "low" | "medium" | "high";
  title: string;
  body: string;
  acceptanceCriterion?: string;
};

/** Bounded, non-browser checks safe to run from the Worker. */
export async function runDeterministicChecks(sourceUrl: string): Promise<CheckFinding[]> {
  const findings: CheckFinding[] = [];
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return [
      {
        provenance: "deterministic_check",
        category: "Release presentation",
        severity: "blocker",
        confidence: "high",
        title: "Release source URL is not a valid absolute URL",
        body: `Could not parse source URL: ${sourceUrl}`,
        acceptanceCriterion: "Provide a valid https URL for the release snapshot.",
      },
    ];
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    findings.push({
      provenance: "deterministic_check",
      category: "Release presentation",
      severity: "high",
      confidence: "high",
      title: "Release URL should use HTTPS",
      body: `Observed protocol ${url.protocol}. Public consumer apps should prefer HTTPS.`,
      acceptanceCriterion: "Release source URL uses https://",
    });
  }

  // SSRF-ish guard: do not fetch private/reserved hosts from the Worker for arbitrary URLs.
  if (isBlockedHost(url.hostname)) {
    findings.push({
      provenance: "deterministic_check",
      category: "Release presentation",
      severity: "blocker",
      confidence: "high",
      title: "Release host is blocked for automated fetch",
      body: "Private or reserved hostnames cannot be crawled from the platform Worker.",
      acceptanceCriterion: "Use a publicly reachable HTTPS origin for automated review.",
    });
    return findings;
  }

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "OCLaunch-DeterministicCheck/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (res.status >= 400) {
      findings.push({
        provenance: "deterministic_check",
        category: "First-use experience",
        severity: "high",
        confidence: "high",
        title: `Release URL returned HTTP ${res.status}`,
        body: `GET ${url.toString()} responded with status ${res.status}.`,
        acceptanceCriterion: "Primary release URL returns a successful response for anonymous visitors.",
      });
    }
    if (ct.includes("text/html")) {
      const html = (await res.text()).slice(0, 200_000);
      if (!/<title[^>]*>\s*\S+/i.test(html)) {
        findings.push({
          provenance: "deterministic_check",
          category: "Clarity",
          severity: "medium",
          confidence: "medium",
          title: "Document title appears missing",
          body: "No non-empty <title> was found in the first HTML response chunk.",
          acceptanceCriterion: "Page includes a descriptive <title> element.",
        });
      }
      if (!/meta\s+name=["']description["']/i.test(html)) {
        findings.push({
          provenance: "deterministic_check",
          category: "Release presentation",
          severity: "low",
          confidence: "medium",
          title: "Meta description not detected",
          body: "No meta name=description tag was found in the HTML head sample.",
          acceptanceCriterion: "Add a concise meta description for link previews.",
        });
      }
      if (!/rel=["']icon["']/i.test(html) && !/rel=["']shortcut icon["']/i.test(html)) {
        findings.push({
          provenance: "deterministic_check",
          category: "Visual consistency",
          severity: "low",
          confidence: "low",
          title: "Favicon link not detected",
          body: "No favicon link relation was found in the HTML sample.",
          acceptanceCriterion: "Document links a favicon for browser tabs.",
        });
      }
    }
  } catch (err) {
    findings.push({
      provenance: "deterministic_check",
      category: "First-use experience",
      severity: "high",
      confidence: "medium",
      title: "Could not fetch release URL",
      body: err instanceof Error ? err.message : "fetch_failed",
      acceptanceCriterion: "Primary release URL is reachable from the public internet.",
    });
  }

  return findings;
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return false; // allowed in dev checks label only
  if (h === "metadata.google.internal") return true;
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;
  // Block obvious private IPv4 literals
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const parts = h.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  }
  return false;
}
