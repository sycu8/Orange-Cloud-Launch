import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, setCsrfToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, Input, Label, Notice, PageHeader } from "../components/ui";

export function AccountPage() {
  const { me, loading, refresh } = useAuth();
  const { t } = useI18n();
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

  if (loading) return <p className="text-muted">{t("common.loading")}</p>;
  if (!me) return <Navigate to="/signin" replace />;

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const result = await api<{ csrfToken: string }>("/api/auth/recovery/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setCsrfToken(result.csrfToken);
      await refresh();
      setMessage(t("account.redeemed"));
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("account.redeemError"));
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader title={t("account.title")} subtitle={`${me.user.display_name}. ${t("account.subtitle")}`} />
      <div className="mb-6 rounded-[16px] border border-border bg-surface p-4">
        <p className="text-sm font-semibold text-muted">{t("account.credits")}</p>
        <p className="text-3xl font-bold">{credits}</p>
        <p className="mt-1 text-sm text-muted">{t("account.creditsHelp")}</p>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {recent.slice(0, 5).map((row, i) => (
            <li key={`${row.created_at}-${i}`}>
              +{row.amount} · {row.reason.replaceAll("_", " ")}
            </li>
          ))}
          {recent.length === 0 ? <li>{t("account.creditsEmpty")}</li> : null}
        </ul>
      </div>
      <form onSubmit={(e) => void redeem(e)} className="space-y-3 rounded-[16px] border border-border bg-surface p-4">
        <h2 className="font-semibold">{t("account.redeemTitle")}</h2>
        <p className="text-sm text-muted">{t("account.redeemBody")}</p>
        <div>
          <Label>{t("signin.recovery")}</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full sm:w-auto">
          {t("account.redeem")}
        </Button>
        {message ? (
          <Notice title={t("common.update")} tone="positive">
            {message}
          </Notice>
        ) : null}
        {error ? (
          <Notice title={t("account.redeemError")} tone="danger">
            {error}
          </Notice>
        ) : null}
      </form>
    </div>
  );
}
