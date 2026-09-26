import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { LanguageProvider } from "./lib/i18n";
import { AppShell, MarketingShell } from "./components/Shell";
import { HomePage } from "./pages/Home";
import { SignInPage } from "./pages/SignIn";
import { DiscoverPage } from "./pages/Discover";
import { WorkspacePage } from "./pages/Workspace";
import { NewProjectPage } from "./pages/NewProject";
import { ReviewInvitePage } from "./pages/ReviewInvite";
import { IntegrationsPage } from "./pages/Integrations";
import { ReviewInboxPage } from "./pages/ReviewInbox";
import { AccountPage } from "./pages/Account";
import { ProjectLayout } from "./pages/project/ProjectLayout";
import { ProjectOverviewPage } from "./pages/project/Overview";
import { ReleaseWorkspacePage } from "./pages/project/ReleaseWorkspace";
import { MissionsPage } from "./pages/project/Missions";
import { ChangesPage } from "./pages/project/Changes";
import { ChangeDetailPage } from "./pages/project/ChangeDetail";
import { ReportsPage } from "./pages/project/Reports";
import { ReportDetailPage } from "./pages/project/ReportDetail";
import { ProjectSettingsPage } from "./pages/project/ProjectSettings";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<MarketingShell />}>
              <Route index element={<HomePage />} />
              <Route path="signin" element={<SignInPage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="review/:token" element={<ReviewInvitePage />} />
            </Route>
            <Route path="app" element={<AppShell />}>
              <Route index element={<WorkspacePage />} />
              <Route path="new" element={<NewProjectPage />} />
              <Route path="inbox" element={<ReviewInboxPage />} />
              <Route path="settings/integrations" element={<IntegrationsPage />} />
              <Route path="settings/account" element={<AccountPage />} />
              <Route path="projects/:id" element={<ProjectLayout />}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<ProjectOverviewPage />} />
                <Route path="missions" element={<MissionsPage />} />
                <Route path="changes" element={<ChangesPage />} />
                <Route path="changes/:changeId" element={<ChangeDetailPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="reports/:reportId" element={<ReportDetailPage />} />
                <Route path="settings" element={<ProjectSettingsPage />} />
                <Route path="releases/:releaseId" element={<ReleaseWorkspacePage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
);
