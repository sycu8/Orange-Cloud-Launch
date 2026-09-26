import { Link } from "react-router-dom";
import { PRODUCT } from "@oclaunch/shared";
import { Button } from "../components/ui";
import iconUrl from "../assets/oclaunch-icon.svg";

export function HomePage() {
  return (
    <div>
      <section className="relative mx-auto grid min-h-[calc(100vh-7rem)] max-w-6xl items-center gap-10 px-4 pb-16 pt-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-rise">
          <div className="mb-5 flex items-center gap-3">
            <img src={iconUrl} alt="" className="h-14 w-14 hero-loop" />
            <div>
              <p className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">OCLaunch</p>
              <p className="text-sm font-semibold text-action">{PRODUCT.tagline}</p>
            </div>
          </div>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            {PRODUCT.headline}
          </h1>
          <p className="mt-4 max-w-lg text-lg text-muted">{PRODUCT.support}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app/new">
              <Button>{PRODUCT.primaryCta}</Button>
            </Link>
            <Link to="/discover">
              <Button variant="secondary">{PRODUCT.secondaryCta}</Button>
            </Link>
          </div>
        </div>
        <div
          className="animate-rise-delay relative min-h-[320px] overflow-hidden rounded-none border-y border-border bg-ink text-canvas lg:min-h-[420px] lg:rounded-[24px] lg:border"
          aria-label="Labeled product example of the review loop"
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(circle at 20% 20%, #FF8A4C55, transparent 40%), radial-gradient(circle at 80% 70%, #0F766E55, transparent 45%)",
            }}
          />
          <div className="relative flex h-full flex-col justify-between p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#DFE4E2]">
              Example loop · fictional demo product
            </p>
            <ol className="space-y-4 text-sm sm:text-base">
              <li>
                <span className="font-semibold text-accent">1. Capture release</span>
                <p className="text-[#DFE4E2]">Freeze a URL, viewport, and ruleset version.</p>
              </li>
              <li>
                <span className="font-semibold text-accent">2. Focused review</span>
                <p className="text-[#DFE4E2]">
                  “Create your first weekly plan without help.”
                </p>
              </li>
              <li>
                <span className="font-semibold text-accent">3. Improve with evidence</span>
                <p className="text-[#DFE4E2]">Accept findings, export tasks, or open a draft PR.</p>
              </li>
              <li>
                <span className="font-semibold text-[#5EEAD4]">4. Verify & report</span>
                <p className="text-[#DFE4E2]">Record what got better before the next release.</p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold">The improvement loop</h2>
          <p className="mt-2 max-w-2xl text-muted">
            Add a project, capture a release, collect evidence, select improvements, then verify
            what shipped. A merged PR alone is not a completed loop.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ["Useful reviews", "Task outcomes, pins, and distinguishable finding sources."],
              ["Reviewable changes", "Agent export now; sandbox preview + draft PR when configured."],
              ["Evidence-based reports", "Coverage, accepted work, and the next three actions."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
