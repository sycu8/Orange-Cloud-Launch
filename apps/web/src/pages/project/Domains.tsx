import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Button, Input, Label, Notice } from "../../components/ui";

type DomainRow = {
  id: string;
  hostname: string;
  upstream_url: string;
  state: string;
  verified_at: string | null;
};

export function DomainsPage() {
  const { id } = useParams();
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [hostname, setHostname] = useState("");
  const [upstreamUrl, setUpstreamUrl] = useState("https://example.com");
  const [challenge, setChallenge] = useState<{
    path: string;
    body: string;
    expiresAt: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api<{ domains: DomainRow[]; enabled: boolean }>(
      `/api/projects/${id}/domains`,
    );
    setDomains(res.domains);
    setEnabled(res.enabled);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [id]);

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await api<{
        id: string;
        note: string;
        verification: { path: string; body: string; expiresAt: string };
      }>(`/api/projects/${id}/domains`, {
        method: "POST",
        body: JSON.stringify({ hostname, upstreamUrl }),
      });
      setChallenge(res.verification);
      setMessage(res.note);
      await load();
    } catch (err) {
      const apiErr = err as Error & { api?: { message?: string; nextAction?: string } };
      setError([apiErr.api?.message || apiErr.message, apiErr.api?.nextAction].filter(Boolean).join(" — "));
    }
  }

  async function verify(domainId: string) {
    setError(null);
    try {
      const res = await api<{
        verified: boolean;
        activation: { status: string; message: string };
      }>(`/api/projects/${id}/domains/${domainId}/verify`, {
        method: "POST",
        body: "{}",
      });
      setMessage(
        res.verified
          ? `Ownership verified. Activation: ${res.activation.status} — ${res.activation.message}`
          : "Not verified",
      );
      await load();
    } catch (err) {
      const apiErr = err as Error & { api?: { message?: string; nextAction?: string } };
      setError([apiErr.api?.message || apiErr.message, apiErr.api?.nextAction].filter(Boolean).join(" — "));
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold">Project domain</h2>
      <p className="mt-1 text-sm text-muted">
        Claim <code>&lt;slug&gt;.orangecloud.vn</code>, prove upstream ownership, then wait for
        approved gateway activation. Live DNS is never changed automatically here.
      </p>
      <p className="mt-2 text-sm">
        Gateway flag:{" "}
        <strong>{enabled ? "ENABLE_PROJECT_DOMAINS=true" : "disabled (activation blocked)"}</strong>
      </p>
      <form onSubmit={(e) => void claim(e)} className="mt-4 space-y-3 rounded-[16px] border border-border bg-surface p-4">
        <div>
          <Label>Hostname</Label>
          <Input
            required
            placeholder="my-app.orangecloud.vn"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
          />
        </div>
        <div>
          <Label>Upstream URL</Label>
          <Input
            required
            type="url"
            value={upstreamUrl}
            onChange={(e) => setUpstreamUrl(e.target.value)}
          />
        </div>
        <Button type="submit">Request ownership challenge</Button>
      </form>
      {challenge ? (
        <div className="mt-4">
          <Notice title="Serve this nonce on the upstream" tone="action">
            <p>
              Path: <code>{challenge.path}</code>
            </p>
            <p className="break-all font-mono text-xs">{challenge.body}</p>
            <p className="mt-1 text-xs">Expires {challenge.expiresAt}</p>
          </Notice>
        </div>
      ) : null}
      <ul className="mt-6 space-y-3">
        {domains.map((d) => (
          <li key={d.id} className="rounded-[16px] border border-border bg-surface p-4">
            <p className="font-semibold">{d.hostname}</p>
            <p className="text-sm text-muted">
              {d.state} · {d.upstream_url}
            </p>
            <Button className="mt-3" variant="secondary" onClick={() => void verify(d.id)}>
              Verify ownership
            </Button>
          </li>
        ))}
      </ul>
      {message ? (
        <div className="mt-4">
          <Notice title="Domain update" tone="positive">
            {message}
          </Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-4">
          <Notice title="Domain action blocked" tone="danger">
            {error}
          </Notice>
        </div>
      ) : null}
    </div>
  );
}
