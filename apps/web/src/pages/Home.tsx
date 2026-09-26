import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useHomeDocument } from "../lib/home-seo";
import { useI18n } from "../lib/i18n";
import { Button } from "../components/ui";
import iconUrl from "../assets/oclaunch-icon.svg";

const PROJECT_CARDS = ["1", "2", "3"] as const;
const HOW_STEPS = ["1", "2", "3", "4"] as const;
const START_STEPS = ["1", "2", "3", "4", "5", "6", "7"] as const;
const VALUE_CARDS = ["1", "2", "3", "4"] as const;
const VALUE_ROWS = ["1", "2", "3", "4"] as const;
const WHERE_CARDS = ["1", "2", "3"] as const;
const FAQS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

const PAGE_LINKS = [
  ["project", "home.nav.project"],
  ["how-it-works", "home.nav.how"],
  ["how-to", "home.nav.howto"],
  ["value", "home.nav.value"],
  ["where", "home.nav.where"],
  ["faq", "home.nav.faq"],
] as const;

function Band({
  id,
  tone,
  labelledBy,
  children,
}: {
  id: string;
  tone: "canvas" | "surface";
  labelledBy: string;
  children: ReactNode;
}) {
  const bg = tone === "surface" ? "border-y border-border bg-surface" : "";
  return (
    <section id={id} aria-labelledby={labelledBy} className={`scroll-mt-24 ${bg}`}>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">{children}</div>
    </section>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-action">{children}</p>
  );
}

export function HomePage() {
  const { me } = useAuth();
  const { lang, t } = useI18n();
  useHomeDocument(lang, t);
  const reviewHref = me ? "/app/inbox" : "/signin?next=/app/inbox";
  const addHref = me ? "/app/new" : "/signin?next=/app/new";

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border bg-ink">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(900px 480px at 85% 15%, rgba(255,138,76,0.22), transparent 55%), radial-gradient(700px 420px at 8% 85%, rgba(15,118,110,0.14), transparent 50%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-14 pt-8 sm:pb-16 sm:pt-10 lg:grid-cols-2 lg:items-center lg:gap-12 lg:pb-20 lg:pt-14">
          <div className="animate-rise text-canvas">
            <div className="mb-6 flex items-center gap-3">
              <img
                src={iconUrl}
                alt=""
                className="h-16 w-16 shrink-0 hero-loop sm:h-[4.5rem] sm:w-[4.5rem]"
                width={72}
                height={72}
              />
              <div className="min-w-0">
                <p className="text-3xl font-bold tracking-tight sm:text-4xl">OCLaunch</p>
                <p className="text-sm font-semibold text-accent sm:text-base">{t("home.tagline")}</p>
              </div>
            </div>
            <h1 className="max-w-xl text-[2.125rem] font-bold leading-[1.12] tracking-tight sm:text-5xl">
              {t("home.headline")}
            </h1>
            <p className="mt-4 max-w-md text-base text-[#DFE4E2] sm:text-lg">{t("home.support")}</p>
            <HomeCtas addHref={addHref} reviewHref={reviewHref} />
          </div>

          <div
            className="animate-rise-delay relative min-h-[280px] overflow-hidden rounded-[16px] border border-[#2a3d44] bg-[#132024] text-canvas sm:min-h-[340px] lg:min-h-[380px] lg:rounded-[24px]"
            aria-label={t("home.example.label")}
          >
            <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                {t("home.example.label")}
              </p>
              <ol className="mt-6 space-y-3.5 text-sm sm:mt-8 sm:space-y-4 sm:text-base">
                <li className="border-l-2 border-accent pl-3">
                  <span className="font-semibold text-accent">{t("home.example.capture")}</span>
                  <p className="text-[#DFE4E2]">{t("home.example.captureBody")}</p>
                </li>
                <li className="border-l-2 border-accent pl-3">
                  <span className="font-semibold text-accent">{t("home.example.review")}</span>
                  <p className="text-[#DFE4E2]">{t("home.example.reviewBody")}</p>
                </li>
                <li className="border-l-2 border-accent pl-3">
                  <span className="font-semibold text-accent">{t("home.example.improve")}</span>
                  <p className="text-[#DFE4E2]">{t("home.example.improveBody")}</p>
                </li>
                <li className="border-l-2 border-positive pl-3">
                  <span className="font-semibold text-[#5EEAD4]">{t("home.example.verify")}</span>
                  <p className="text-[#DFE4E2]">{t("home.example.verifyBody")}</p>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <nav aria-label={t("home.nav.label")} className="border-b border-border bg-canvas">
        <ul className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 text-sm font-semibold">
          {PAGE_LINKS.map(([id, key]) => (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                className="inline-flex min-h-[44px] items-center rounded-full px-3 text-ink no-underline hover:bg-orange-tint"
              >
                {t(key)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Band id="project" tone="canvas" labelledBy="project-title">
        <Kicker>{t("home.project.kicker")}</Kicker>
        <h2
          id="project-title"
          className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-ink sm:text-4xl"
        >
          {t("home.project.title")}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
          {t("home.project.lead")}
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PROJECT_CARDS.map((n) => (
            <article key={n} className="rounded-[16px] border border-border bg-surface p-5">
              <h3 className="text-lg font-bold text-ink">{t(`home.project.${n}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                {t(`home.project.${n}.body`)}
              </p>
            </article>
          ))}
        </div>
      </Band>

      <Band id="how-it-works" tone="surface" labelledBy="how-title">
        <Kicker>{t("home.how.kicker")}</Kicker>
        <h2 id="how-title" className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t("home.how.title")}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
          {t("home.how.lead")}
        </p>
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          {HOW_STEPS.map((n) => (
            <li key={n} className="rounded-[16px] border border-border bg-canvas p-5">
              <p className="text-sm font-bold text-action">0{n}</p>
              <h3 className="mt-2 text-lg font-bold text-ink">{t(`home.how.${n}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                {t(`home.how.${n}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </Band>

      <Band id="how-to" tone="canvas" labelledBy="howto-title">
        <Kicker>{t("home.howto.kicker")}</Kicker>
        <h2
          id="howto-title"
          className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-ink sm:text-4xl"
        >
          {t("home.howto.title")}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
          {t("home.howto.lead")}
        </p>
        <ol className="mt-8 space-y-3">
          {START_STEPS.map((n, index) => (
            <li key={n} className="flex gap-4 rounded-[16px] border border-border bg-surface p-5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-tint text-sm font-bold text-action"
                aria-hidden
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-lg font-bold text-ink">{t(`home.howto.${n}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted sm:text-base">
                  {t(`home.howto.${n}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Band>

      <Band id="value" tone="surface" labelledBy="value-title">
        <Kicker>{t("home.value.kicker")}</Kicker>
        <h2
          id="value-title"
          className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-ink sm:text-4xl"
        >
          {t("home.value.title")}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
          {t("home.value.lead")}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {VALUE_CARDS.map((n) => (
            <article key={n} className="rounded-[16px] border border-border bg-canvas p-5">
              <h3 className="text-lg font-bold text-ink">{t(`home.value.${n}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                {t(`home.value.${n}.body`)}
              </p>
            </article>
          ))}
        </div>

        <h3 className="mt-12 text-2xl font-bold tracking-tight text-ink">{t("home.value.roiTitle")}</h3>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted">{t("home.value.roiBody")}</p>
        <div className="mt-6 overflow-x-auto rounded-[16px] border border-border bg-canvas">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">{t("home.value.tableCaption")}</caption>
            <thead className="bg-orange-tint text-ink">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t("home.value.col.step")}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t("home.value.col.before")}
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  {t("home.value.col.after")}
                </th>
              </tr>
            </thead>
            <tbody>
              {VALUE_ROWS.map((n) => (
                <tr key={n} className="border-t border-border">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">
                    {t(`home.value.row${n}.step`)}
                  </th>
                  <td className="px-4 py-3 text-muted">{t(`home.value.row${n}.before`)}</td>
                  <td className="px-4 py-3 text-ink">{t(`home.value.row${n}.after`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-12 text-2xl font-bold tracking-tight text-ink">{t("home.value.opsTitle")}</h3>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted">{t("home.value.opsBody")}</p>
      </Band>

      <Band id="where" tone="canvas" labelledBy="where-title">
        <Kicker>{t("home.where.kicker")}</Kicker>
        <h2
          id="where-title"
          className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-ink sm:text-4xl"
        >
          {t("home.where.title")}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted sm:text-lg">
          {t("home.where.lead")}
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {WHERE_CARDS.map((n) => (
            <article key={n} className="rounded-[16px] border border-border bg-surface p-5">
              <h3 className="text-lg font-bold text-ink">{t(`home.where.${n}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                {t(`home.where.${n}.body`)}
              </p>
            </article>
          ))}
        </div>
      </Band>

      <Band id="faq" tone="surface" labelledBy="faq-title">
        <Kicker>{t("home.faq.kicker")}</Kicker>
        <h2 id="faq-title" className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t("home.faq.title")}
        </h2>
        <div className="mt-8 divide-y divide-border rounded-[16px] border border-border bg-canvas">
          {FAQS.map((n) => (
            <article key={n} className="px-5 py-5">
              <h3 className="text-lg font-bold text-ink">{t(`home.faq.${n}.q`)}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
                {t(`home.faq.${n}.a`)}
              </p>
            </article>
          ))}
        </div>
      </Band>

      <section className="bg-ink text-canvas" aria-labelledby="closing-title">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 id="closing-title" className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            {t("home.closing.title")}
          </h2>
          <p className="mt-3 max-w-xl text-base text-[#DFE4E2] sm:text-lg">{t("home.closing.body")}</p>
          <HomeCtas addHref={addHref} reviewHref={reviewHref} />
        </div>
      </section>
    </div>
  );
}

function HomeCtas({ addHref, reviewHref }: { addHref: string; reviewHref: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-8 flex w-full flex-col gap-3 sm:max-w-md sm:flex-row">
      <Link to={addHref} className="sm:flex-1">
        <Button className="w-full">{t("home.cta.add")}</Button>
      </Link>
      <Link to={reviewHref} className="sm:flex-1">
        <Button variant="secondary" className="w-full bg-canvas text-ink">
          {t("home.cta.review")}
        </Button>
      </Link>
    </div>
  );
}
