import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { api, setCsrfToken } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Input, Label, Notice, PageHeader } from "../components/ui";

export function SignInPage() {
  const { refresh, me, loading } = useAuth();
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("Local Founder");
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && me && !recovery) {
    return <Navigate to="/app" replace />;
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
      nav("/app");
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
      nav("/app");
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
        body: JSON.stringify({ displayName }),
      });
      setCsrfToken(result.csrfToken);
      await refresh();
      nav("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dev login unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <PageHeader
        title="Sign in to OCLaunch"
        subtitle="Passkeys are the primary identity. GitHub sign-in does not grant repository access."
      />
      <div className="space-y-4 rounded-[16px] border border-border bg-surface p-5">
        <div>
          <Label>Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <Notice title="Local development" tone="action">
          Fastest path on this machine: continue without a hardware authenticator. Disabled when{" "}
          <code>APP_ENV=production</code>.
          <div className="mt-3">
            <Button disabled={busy} onClick={() => void devLogin()}>
              Continue as local founder
            </Button>
          </div>
        </Notice>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="secondary" disabled={busy} onClick={() => void registerPasskey()}>
            Create passkey
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void loginPasskey()}>
            Sign in with passkey
          </Button>
        </div>
        <div className="space-y-2 border-t border-border pt-4">
          <Label>Recovery code</Label>
          <Input
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder="Single-use code from passkey registration"
          />
          <Button variant="secondary" disabled={busy || !recoveryCode} onClick={() => void redeemRecovery()}>
            Redeem recovery code
          </Button>
        </div>
        {error ? (
          <Notice title="Could not complete sign-in" tone="danger">
            {error}
          </Notice>
        ) : null}
        {recovery ? (
          <Notice title="Store these recovery codes now" tone="positive">
            <p className="mb-2">They are shown once. Each code is single-use.</p>
            <ul className="font-mono text-xs">
              {recovery.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="mt-3">
              <Link to="/app">
                <Button>Go to workspace</Button>
              </Link>
            </div>
          </Notice>
        ) : null}
      </div>
    </div>
  );
}
