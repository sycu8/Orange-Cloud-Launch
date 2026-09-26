import { useAuth } from "../lib/auth";
import { Notice, PageHeader, StatusPill } from "../components/ui";

export function IntegrationsPage() {
  const { me } = useAuth();
  const flags = me?.integrations;

  const rows = [
    ["Passkeys", true, "Primary identity with recovery codes"],
    ["GitHub App", flags?.github, "Selected-repo broker for draft PRs"],
    ["Browser Run", flags?.browserRun, "Viewport captures and journey checks"],
    ["Workers AI", flags?.workersAi, "Labeled model suggestions only"],
    ["Sandbox patch/PR", flags?.patchPr, "Isolated build + draft PR path"],
    ["Project domains", flags?.projectDomains, "Verified <slug>.orangecloud.vn gateway"],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Missing credentials produce an honest not-configured state — never a fake success."
      />
      <ul className="divide-y divide-border border-y border-border">
        {rows.map(([name, enabled, detail]) => (
          <li key={name} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-semibold">{name}</p>
              <p className="text-sm text-muted">{detail}</p>
            </div>
            <StatusPill tone={enabled ? "positive" : "action"}>
              {enabled ? "Configured" : "Not configured"}
            </StatusPill>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Notice title="Owner actions required for remote features" tone="neutral">
          Provision D1/R2 IDs, GitHub App secrets, Browser Rendering, Workers AI, and Sandbox
          bindings. Approve DNS inventory before enabling project-domain gateway routes. See{" "}
          <code>docs/deployment.md</code>.
        </Notice>
      </div>
    </div>
  );
}
