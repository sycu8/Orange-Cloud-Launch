/** Browser Run adapter — real binding requires Cloudflare Browser Rendering credentials. */
export async function runBrowserReview(
  env: { ENABLE_BROWSER_RUN: string },
  sourceUrl: string,
): Promise<{
  status: "skipped" | "integration_not_configured" | "completed";
  message: string;
  sourceUrl: string;
}> {
  if (env.ENABLE_BROWSER_RUN !== "true") {
    return {
      status: "integration_not_configured",
      message:
        "Browser Run is disabled. Deterministic checks still ran. Set ENABLE_BROWSER_RUN=true and bind Browser Rendering to capture viewports.",
      sourceUrl,
    };
  }
  return {
    status: "integration_not_configured",
    message:
      "Browser Run binding is not provisioned in this environment. No screenshots were claimed.",
    sourceUrl,
  };
}
