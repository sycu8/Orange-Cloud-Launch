import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Notice, PageHeader, StatusPill } from "../components/ui";

/** Hidden from primary nav until the founder loop is solid. Keep an honest short page. */
export function IntegrationsPage() {
  const { me, loading } = useAuth();
  if (loading) return <p className="text-muted">Loading…</p>;
  if (!me) return <Navigate to="/signin?next=/app/settings/integrations" replace />;
  const flags = me.integrations;

  const rows = [
    ["GitHub App", flags?.github, "Selected-repo broker for draft PRs"],
    ["Browser Run", flags?.browserRun, "Human-tester viewport snapshots and route discovery"],
    ["Workers AI", flags?.workersAi, "Labeled model suggestions only"],
    ["Sandbox patch/PR", flags?.patchPr, "Isolated build + draft PR path"],
    ["Project domains", flags?.projectDomains, "Verified <slug>.orangecloud.vn gateway"],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="Missing credentials stay not configured — never a fake success."
      />
      <ul className="divide-y divide-border border-y border-border">
        {rows.map(([name, enabled, detail]) => (
          <li key={name} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-semibold">{name}</p>
              <p className="text-sm text-muted">{detail}</p>
            </div>
            <StatusPill tone={enabled ? "positive" : "action"}>
              {enabled ? "Connected" : "Not connected yet"}
            </StatusPill>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Notice title="Credential-gated" tone="neutral">
          Browser Run, Sandbox, GitHub draft PR, and live DNS stay{" "}
          <code>integration_not_configured</code> until the owner provisions them. Passkeys are
          available on Sign in when your environment supports WebAuthn.
        </Notice>
      </div>
    </div>
  );
}
