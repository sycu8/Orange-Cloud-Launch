export type StackProfile = {
  supported: boolean;
  profile: "react-vite-tailwind" | "unsupported" | "unknown";
  signals: string[];
  recommendation: "draft_pr_when_configured" | "agent_export";
  message: string;
};

/** Deterministic stack sniff from package.json text — no repo clone, no fake success. */
export function detectStackFromPackageJson(raw: string): StackProfile {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      supported: false,
      profile: "unknown",
      signals: ["invalid_json"],
      recommendation: "agent_export",
      message: "Could not parse package.json. Use agent export until a supported profile is detected.",
    };
  }
  const deps = {
    ...(typeof pkg.dependencies === "object" && pkg.dependencies ? pkg.dependencies : {}),
    ...(typeof pkg.devDependencies === "object" && pkg.devDependencies
      ? pkg.devDependencies
      : {}),
  } as Record<string, string>;
  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const signals: string[] = [];
  const hasReact = Boolean(deps.react);
  const hasVite = Boolean(deps.vite) || Object.values(scripts).some((s) => /\bvite\b/.test(s));
  const hasTailwind =
    Boolean(deps.tailwindcss) || Boolean(deps["@tailwindcss/vite"]);
  if (hasReact) signals.push("react");
  if (hasVite) signals.push("vite");
  if (hasTailwind) signals.push("tailwind");
  if (deps.next) signals.push("next");
  if (deps.nuxt) signals.push("nuxt");

  if (hasReact && hasVite && hasTailwind && !deps.next) {
    return {
      supported: true,
      profile: "react-vite-tailwind",
      signals,
      recommendation: "draft_pr_when_configured",
      message:
        "Supported profile detected. Draft PR / sandbox preview remains integration_not_configured until GitHub App + Sandbox credentials are provisioned.",
    };
  }
  return {
    supported: false,
    profile: signals.length ? "unsupported" : "unknown",
    signals,
    recommendation: "agent_export",
    message:
      "Unsupported or incomplete stack for automated draft PR. Use agent export with your own coding agent.",
  };
}
