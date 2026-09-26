import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, setCsrfToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Input, Label, Notice, PageHeader } from "../components/ui";

export function AccountPage() {
  const { me, loading, refresh } = useAuth();
  const [credits, setCredits] = useState(0);
  const [recent, setRecent] = useState<Array<{ amount: number; reason: string; created_at: string }>>(
    [],
  );
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api<{ balance: number; recent: Array<{ amount: number; reason: string; created_at: string }> }>(
      "/api/credits",
    )
      .then((d) => {
        setCredits(d.balance);
        setRecent(d.recent);
      })
      .catch(() => undefined);
  }, [me]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (!me) return <Navigate to="/signin" replace />;

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      // Logout first conceptually — redeem creates a new session for the recovered user.
      const result = await api<{ csrfToken: string }>("/api/auth/recovery/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setCsrfToken(result.csrfToken);
      await refresh();
      setMessage("Recovery code accepted. You are signed in.");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redeem failed");
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Account"
        subtitle={`${me.user.display_name} · recovery codes and review credits`}
      />
      <div className="mb-6 rounded-[16px] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-muted">Review credit balance</p>
        <p className="text-3xl font-bold">{credits}</p>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {recent.slice(0, 5).map((r, i) => (
            <li key={`${r.created_at}-${i}`}>
              +{r.amount} · {r.reason}
            </li>
          ))}
          {recent.length === 0 ? <li>No credits yet — complete a useful review.</li> : null}
        </ul>
      </div>
      <form onSubmit={(e) => void redeem(e)} className="space-y-3 rounded-[16px] border border-border bg-surface p-4">
        <h2 className="font-semibold">Redeem a recovery code</h2>
        <p className="text-sm text-muted">
          Single-use codes issued when you create a passkey. There is no email-based reset.
        </p>
        <div>
          <Label>Recovery code</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <Button type="submit">Redeem</Button>
        {message ? (
          <Notice title="Signed in" tone="positive">
            {message}
          </Notice>
        ) : null}
        {error ? (
          <Notice title="Could not redeem" tone="danger">
            {error}
          </Notice>
        ) : null}
      </form>
    </div>
  );
}
