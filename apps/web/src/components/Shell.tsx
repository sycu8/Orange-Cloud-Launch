import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LanguageSelect, useI18n } from "../lib/i18n";
import { Button } from "./ui";
import iconUrl from "../assets/oclaunch-icon.svg";

export function MarketingShell() {
  const { me, logout } = useAuth();
  const { t } = useI18n();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2 text-ink no-underline">
            <img src={iconUrl} alt="" className="h-9 w-9 shrink-0" width={36} height={36} />
            <span className="truncate text-lg font-bold tracking-tight">OCLaunch</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <LanguageSelect compact />
            <Link
              to="/discover"
              className="hidden min-h-[44px] items-center px-2 text-sm font-semibold text-ink no-underline sm:inline-flex"
            >
              {t("nav.discover")}
            </Link>
            {me ? (
              <>
                <Link
                  to="/app"
                  className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-ink no-underline"
                >
                  {t("nav.workspace")}
                </Link>
                <span className="hidden sm:inline-flex">
                  <Button variant="ghost" onClick={() => void logout()}>
                    {t("nav.logOut")}
                  </Button>
                </span>
              </>
            ) : (
              <Link to="/signin">
                <Button>{t("nav.signIn")}</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <nav aria-label={t("home.footer.nav")} className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
            <a href="/#project" className="inline-flex min-h-[44px] items-center text-sm font-semibold">
              {t("home.nav.project")}
            </a>
            <a href="/#how-it-works" className="inline-flex min-h-[44px] items-center text-sm font-semibold">
              {t("home.nav.how")}
            </a>
            <a href="/#how-to" className="inline-flex min-h-[44px] items-center text-sm font-semibold">
              {t("home.nav.howto")}
            </a>
            <a href="/#value" className="inline-flex min-h-[44px] items-center text-sm font-semibold">
              {t("home.nav.value")}
            </a>
            <a href="/#where" className="inline-flex min-h-[44px] items-center text-sm font-semibold">
              {t("home.nav.where")}
            </a>
            <a href="/#faq" className="inline-flex min-h-[44px] items-center text-sm font-semibold">
              {t("home.nav.faq")}
            </a>
          </nav>
          <div className="flex flex-col gap-2 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>{t("home.footer.by")}</p>
            <p className="flex gap-4">
              <a href="/?lang=en" hrefLang="en">
                {t("lang.en")}
              </a>
              <a href="/?lang=vi" hrefLang="vi">
                {t("lang.vi")}
              </a>
            </p>
            <p>{t("home.footer.tagline")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function AppShell() {
  const { me, logout } = useAuth();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-[44px] items-center rounded-[10px] px-3 py-2 text-sm font-semibold no-underline ${
      isActive ? "bg-orange-tint text-action" : "text-ink hover:bg-surface"
    }`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <Link to="/app" className="flex min-w-0 items-center gap-2 text-ink no-underline">
            <img src={iconUrl} alt="" className="h-8 w-8 shrink-0" />
            <span className="truncate font-bold">OCLaunch</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/app" end className={linkClass}>
              {t("nav.myProjects")}
            </NavLink>
            <NavLink to="/app/inbox" className={linkClass}>
              {t("nav.reviewInbox")}
            </NavLink>
            <NavLink to="/discover" className={linkClass}>
              {t("nav.discover")}
            </NavLink>
            <NavLink to="/app/settings/account" className={linkClass}>
              {t("nav.account")}
            </NavLink>
          </nav>
          <div className="flex items-center gap-1">
            <LanguageSelect compact />
            <span className="hidden max-w-[10rem] truncate text-sm text-muted lg:inline">
              {me?.user.display_name}
            </span>
            <Button
              variant="ghost"
              className="md:hidden"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t("nav.close") : t("nav.menu")}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? t("nav.close") : t("nav.menu")}
            </Button>
            <span className="hidden md:inline-flex">
              <Button variant="ghost" onClick={() => void logout()}>
                {t("nav.logOut")}
              </Button>
            </span>
          </div>
        </div>
        {menuOpen ? (
          <nav className="flex flex-col gap-1 border-t border-border px-3 py-3 md:hidden">
            <NavLink to="/app" end className={linkClass} onClick={() => setMenuOpen(false)}>
              {t("nav.myProjects")}
            </NavLink>
            <NavLink to="/app/inbox" className={linkClass} onClick={() => setMenuOpen(false)}>
              {t("nav.reviewInbox")}
            </NavLink>
            <NavLink to="/discover" className={linkClass} onClick={() => setMenuOpen(false)}>
              {t("nav.discover")}
            </NavLink>
            <NavLink
              to="/app/settings/account"
              className={linkClass}
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.account")}
            </NavLink>
            <Button variant="ghost" className="justify-start" onClick={() => void logout()}>
              {t("nav.logOut")}
            </Button>
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
