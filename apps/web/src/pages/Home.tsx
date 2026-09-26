import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button } from "../components/ui";
import iconUrl from "../assets/oclaunch-icon.svg";

export function HomePage() {
  const { me } = useAuth();
  const { t } = useI18n();
  const reviewHref = me ? "/app/inbox" : "/signin?next=/app/inbox";

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
            <p className="mt-4 max-w-md text-base text-[#DFE4E2] sm:text-lg">
              {t("home.support")}
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:max-w-md sm:flex-row">
              <Link to={me ? "/app/new" : "/signin?next=/app/new"} className="sm:flex-1">
                <Button className="w-full">{t("home.cta.add")}</Button>
              </Link>
              <Link to={reviewHref} className="sm:flex-1">
                <Button variant="secondary" className="w-full bg-canvas text-ink">
                  {t("home.cta.review")}
                </Button>
              </Link>
            </div>
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
    </div>
  );
}
