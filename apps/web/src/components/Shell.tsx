import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "./ui";
import iconUrl from "../assets/oclaunch-icon.svg";

export function MarketingShell() {
  const { me, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="flex items-center gap-2 text-ink no-underline">
          <img src={iconUrl} alt="" className="h-9 w-9" width={36} height={36} />
          <span className="text-lg font-bold tracking-tight">OCLaunch</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link to="/discover" className="hidden text-sm font-semibold text-ink no-underline sm:inline">
            Discover
          </Link>
          {me ? (
            <>
              <Link to="/app" className="text-sm font-semibold text-ink no-underline">
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
      </header>
      <Outlet />
      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted">
        <p>A community project by Orangecloud · launch.orangecloud.vn</p>
        <p className="mt-1">Build. Review. Improve.</p>
      </footer>
    </div>
  );
}

export function AppShell() {
  const { me, logout } = useAuth();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-[10px] px-3 py-2 text-sm font-semibold no-underline ${
      isActive ? "bg-orange-tint text-action" : "text-ink hover:bg-surface"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/app" className="flex items-center gap-2 text-ink no-underline">
            <img src={iconUrl} alt="" className="h-8 w-8" />
            <span className="font-bold">OCLaunch</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/app" end className={linkClass}>
              My projects
            </NavLink>
            <NavLink to="/discover" className={linkClass}>
              Discover
            </NavLink>
            <NavLink to="/app/settings/integrations" className={linkClass}>
              Integrations
            </NavLink>
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted sm:inline">{me?.user.display_name}</span>
            <Button variant="ghost" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
