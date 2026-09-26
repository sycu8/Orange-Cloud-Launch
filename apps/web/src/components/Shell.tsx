import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "./ui";
import iconUrl from "../assets/oclaunch-icon.svg";

export function MarketingShell() {
  const { me, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2 text-ink no-underline">
            <img src={iconUrl} alt="" className="h-9 w-9 shrink-0" width={36} height={36} />
            <span className="truncate text-lg font-bold tracking-tight">OCLaunch</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              to="/discover"
              className="hidden min-h-[44px] items-center px-2 text-sm font-semibold text-ink no-underline sm:inline-flex"
            >
              Discover
            </Link>
            {me ? (
              <>
                <Link
                  to="/app"
                  className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-ink no-underline"
                >
                  Workspace
                </Link>
                <Button variant="ghost" onClick={() => void logout()}>
                  Log out
                </Button>
              </>
            ) : (
              <Link to="/signin">
                <Button>Sign in</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-border bg-surface/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>A community project by Orangecloud · launch.orangecloud.vn</p>
          <p>Build. Review. Improve.</p>
        </div>
      </footer>
    </div>
  );
}

export function AppShell() {
  const { me, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-[44px] items-center rounded-[10px] px-3 py-2 text-sm font-semibold no-underline ${
      isActive ? "bg-orange-tint text-action" : "text-ink hover:bg-surface"
    }`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/app" className="flex min-w-0 items-center gap-2 text-ink no-underline">
            <img src={iconUrl} alt="" className="h-8 w-8 shrink-0" />
            <span className="truncate font-bold">OCLaunch</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/app" end className={linkClass}>
              My projects
            </NavLink>
            <NavLink to="/app/inbox" className={linkClass}>
              Review inbox
            </NavLink>
            <NavLink to="/discover" className={linkClass}>
              Discover
            </NavLink>
            <NavLink to="/app/settings/integrations" className={linkClass}>
              Integrations
            </NavLink>
            <NavLink to="/app/settings/account" className={linkClass}>
              Account
            </NavLink>
          </nav>
          <div className="flex items-center gap-1">
            <span className="hidden max-w-[10rem] truncate text-sm text-muted lg:inline">
              {me?.user.display_name}
            </span>
            <Button
              variant="ghost"
              className="md:hidden"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? "Close" : "Menu"}
            </Button>
            <Button variant="ghost" className="hidden md:inline-flex" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
        {menuOpen ? (
          <nav className="flex flex-col gap-1 border-t border-border px-3 py-3 md:hidden">
            <NavLink to="/app" end className={linkClass} onClick={() => setMenuOpen(false)}>
              My projects
            </NavLink>
            <NavLink to="/app/inbox" className={linkClass} onClick={() => setMenuOpen(false)}>
              Review inbox
            </NavLink>
            <NavLink to="/discover" className={linkClass} onClick={() => setMenuOpen(false)}>
              Discover
            </NavLink>
            <NavLink
              to="/app/settings/integrations"
              className={linkClass}
              onClick={() => setMenuOpen(false)}
            >
              Integrations
            </NavLink>
            <NavLink
              to="/app/settings/account"
              className={linkClass}
              onClick={() => setMenuOpen(false)}
            >
              Account
            </NavLink>
            <Button variant="ghost" className="justify-start" onClick={() => void logout()}>
              Log out
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
