import { Link } from "react-router-dom";
import { PRODUCT } from "@oclaunch/shared";
import { Button } from "../components/ui";
import iconUrl from "../assets/oclaunch-icon.svg";

export function HomePage() {
  return (
    <div>
      {/* One composition: brand + headline + CTAs over a full-bleed visual plane */}
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
                <p className="text-sm font-semibold text-accent sm:text-base">{PRODUCT.tagline}</p>
              </div>
            </div>
            <h1 className="max-w-xl text-[2.125rem] font-bold leading-[1.12] tracking-tight sm:text-5xl">
              {PRODUCT.headline}
            </h1>
            <p className="mt-4 max-w-md text-base text-[#DFE4E2] sm:text-lg">{PRODUCT.support}</p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:max-w-md sm:flex-row">
              <Link to="/app/new" className="sm:flex-1">
                <Button className="w-full">{PRODUCT.primaryCta}</Button>
              </Link>
              <Link to="/discover" className="sm:flex-1">
                <Button variant="secondary" className="w-full bg-canvas text-ink">
                  {PRODUCT.secondaryCta}
                </Button>
              </Link>
            </div>
          </div>

          <div
            className="animate-rise-delay relative min-h-[280px] overflow-hidden rounded-[16px] border border-[#2a3d44] bg-[#132024] text-canvas sm:min-h-[340px] lg:min-h-[380px] lg:rounded-[24px]"
            aria-label="Labeled product example of the review loop"
          >
            <div className="relative flex h-full flex-col justify-between p-5 sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Example loop · fictional demo product
              </p>
              <ol className="mt-6 space-y-3.5 text-sm sm:mt-8 sm:space-y-4 sm:text-base">
                <li className="border-l-2 border-accent pl-3">
                  <span className="font-semibold text-accent">Capture release</span>
                  <p className="text-[#DFE4E2]">Freeze a URL, viewport, and ruleset version.</p>
                </li>
                <li className="border-l-2 border-accent pl-3">
                  <span className="font-semibold text-accent">Focused review</span>
                  <p className="text-[#DFE4E2]">
                    “Create your first weekly plan without help.”
                  </p>
                </li>
                <li className="border-l-2 border-accent pl-3">
                  <span className="font-semibold text-accent">Improve with evidence</span>
                  <p className="text-[#DFE4E2]">Accept findings, export tasks, or open a draft PR.</p>
                </li>
                <li className="border-l-2 border-positive pl-3">
                  <span className="font-semibold text-[#5EEAD4]">Verify &amp; report</span>
                  <p className="text-[#DFE4E2]">Record what got better before the next release.</p>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight">The improvement loop</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Add a project, capture a release, collect evidence, select improvements, then verify
            what shipped. A merged PR alone is not a completed loop.
          </p>
          <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {[
              ["Useful reviews", "Task outcomes, pins, and distinguishable finding sources."],
              ["Reviewable changes", "Agent export now; sandbox preview + draft PR when configured."],
              ["Evidence-based reports", "Coverage, accepted work, and the next three actions."],
            ].map(([title, body], i) => (
              <div
                key={title}
                className="border-t border-border pt-4 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0"
                style={{ borderLeftColor: i === 0 ? undefined : undefined }}
              >
                <h3 className="font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
