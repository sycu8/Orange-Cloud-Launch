import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { api, setCsrfToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, Input, Label, Notice, PageHeader } from "../components/ui";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/app";
  return raw;
}

export function SignInPage() {
  const { refresh, me, loading } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [devSecret, setDevSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  if (!loading && me && !recovery) {
    return <Navigate to={next} replace />;
  }

  async function registerPasskey() {
    setBusy(true);
    setError(null);
    try {
      const opts = await api<{
        options: Parameters<typeof startRegistration>[0]["optionsJSON"];
        challengeId: string;
      }>("/api/auth/passkey/register/options", {
        method: "POST",
        body: JSON.stringify({ displayName }),
      });
      const attestation = await startRegistration({ optionsJSON: opts.options });
      const verified = await api<{
        csrfToken: string;
        recoveryCodes: string[];
      }>("/api/auth/passkey/register/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId: opts.challengeId, response: attestation }),
      });
      setCsrfToken(verified.csrfToken);
      setRecovery(verified.recoveryCodes);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passkey registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function loginPasskey() {
    setBusy(true);
    setError(null);
    try {
      const opts = await api<{
        options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
        challengeId: string;
      }>("/api/auth/passkey/login/options", { method: "POST", body: "{}" });
      const assertion = await startAuthentication({ optionsJSON: opts.options });
      const verified = await api<{ csrfToken: string }>("/api/auth/passkey/login/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId: opts.challengeId, response: assertion }),
      });
      setCsrfToken(verified.csrfToken);
      await refresh();
      nav(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passkey sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function redeemRecovery() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ csrfToken: string }>("/api/auth/recovery/redeem", {
        method: "POST",
        body: JSON.stringify({ code: recoveryCode }),
      });
      setCsrfToken(result.csrfToken);
      await refresh();
      nav(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery failed");
    } finally {
      setBusy(false);
    }
  }

  async function devLogin() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ csrfToken: string }>("/api/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ secret: devSecret }),
      });
      setCsrfToken(result.csrfToken);
      await refresh();
      nav(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dev login unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <PageHeader title={t("signin.title")} subtitle={t("signin.subtitle")} />
      <div className="space-y-4 rounded-[16px] border border-border bg-surface p-5">
        <div>
          <Label>{t("signin.displayName")}</Label>
          <Input
            value={displayName}
            placeholder={t("signin.displayNamePh")}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="mt-1 text-sm text-muted">{t("signin.passkeyHelp")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button className="w-full sm:w-auto" disabled={busy} onClick={() => void registerPasskey()}>
            {t("signin.createPasskey")}
          </Button>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={busy}
            onClick={() => void loginPasskey()}
          >
            {t("signin.signInPasskey")}
          </Button>
        </div>
        <details className="rounded-[12px] border border-border p-3">
          <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">
            {t("signin.recovery")}
          </summary>
          <p className="mt-2 text-sm text-muted">{t("signin.recoveryHelp")}</p>
          <div className="mt-3 space-y-2">
            <Input
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder={t("signin.recoveryPlaceholder")}
            />
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={busy || !recoveryCode}
              onClick={() => void redeemRecovery()}
            >
              {t("signin.redeem")}
            </Button>
          </div>
        </details>
        {loopback ? (
          <details className="rounded-[12px] border border-border p-3">
            <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">
              {t("signin.localDev")}
            </summary>
            <p className="mt-2 text-sm text-muted">{t("signin.localDevBody")}</p>
            <div className="mt-3 space-y-2">
              <Input
                type="password"
                value={devSecret}
                onChange={(e) => setDevSecret(e.target.value)}
                placeholder={t("signin.localSecret")}
                autoComplete="off"
              />
              <Button
                className="w-full sm:w-auto"
                disabled={busy || !devSecret}
                onClick={() => void devLogin()}
              >
                {t("signin.continueLocal")}
              </Button>
            </div>
          </details>
        ) : null}
        {error ? (
          <Notice title={t("signin.error")} tone="danger">
            {error}
          </Notice>
        ) : null}
        {recovery ? (
          <Notice title={t("signin.codesTitle")} tone="positive">
            <p className="mb-2">{t("signin.codesBody")}</p>
            <ul className="break-all font-mono text-sm">
              {recovery.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => void navigator.clipboard.writeText(recovery.join("\n"))}
              >
                {t("signin.copyCodes")}
              </Button>
              <Link to={next} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">{t("signin.continue")}</Button>
              </Link>
            </div>
          </Notice>
        ) : null}
      </div>
    </div>
  );
}
