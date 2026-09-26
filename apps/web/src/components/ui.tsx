import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-4 text-[15px] font-semibold transition-opacity duration-160 disabled:opacity-50";
  const styles = {
    primary: "bg-action text-white hover:opacity-95",
    secondary: "bg-orange-tint text-ink border border-border hover:opacity-95",
    ghost: "bg-transparent text-ink hover:bg-orange-tint",
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-[44px] w-full rounded-[10px] border border-input-border bg-surface px-3 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${props.className ?? ""}`}
    />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`min-h-[120px] w-full rounded-[10px] border border-input-border bg-surface px-3 py-2 text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${props.className ?? ""}`}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-semibold text-ink">{children}</label>;
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "neutral" | "action" | "positive" | "danger";
  children: ReactNode;
}) {
  const cls = {
    neutral: "bg-surface text-muted border-border",
    action: "bg-orange-tint text-action border-border",
    positive: "bg-positive-tint text-positive border-border",
    danger: "bg-[#FDECEC] text-[#9B1C1C] border-border",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {children}
    </span>
  );
}

export function Notice({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children?: ReactNode;
  tone?: "neutral" | "action" | "positive" | "danger";
}) {
  const border = {
    neutral: "border-border",
    action: "border-accent",
    positive: "border-positive",
    danger: "border-[#E11D48]",
  }[tone];
  return (
    <div className={`rounded-[16px] border ${border} bg-surface p-4`}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted sm:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="w-full shrink-0 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-dashed border-border bg-surface/70 px-6 py-10 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
