import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import AppMenu from "../../components/AppMenu";
import AnalyticsRouteTracker from "../../features/analytics/AnalyticsRouteTracker";
import PlatformAnalyticsPage from "../../pages/admin/PlatformAnalyticsPage";
import AssociationsPage from "../../pages/association/AssociationsPage";
import AssociationShowPage from "../../pages/association/AssociationShowPage";
import AssociationAccessPage from "../../pages/association/AssociationAccessPage";
import AssociationActivityPage from "../../pages/association/AssociationActivityPage";
import AssociationSettingsPage from "../../pages/association/AssociationSettingsPage";
import ShowDetailPage from "../../pages/association/ShowDetailPage";
import SecretariatDashboardPage from "../../pages/association/SecretariatDashboardPage";
import AnnouncerDashboardPage from "../../pages/association/AnnouncerDashboardPage";
import ShowScribePage from "../../pages/association/ShowScribePage";
import PublicResultsPage from "../../pages/association/PublicResultsPage";
import PublicAssociationsPage from "../../pages/public/PublicAssociationsPage";
import PublicAssociationShowsPage from "../../pages/public/PublicAssociationShowsPage";
import ShowTimeManagementPage from "../../pages/association/ShowTimeManagementPage";
import DayClassesPage from "../../pages/association/DayClassesPage";
import ClassSetupPage from "../../pages/association/ClassSetupPage";
import PaidWarmupSetupPage from "../../pages/association/PaidWarmupSetupPage";
import ClassScoringPage from "../../pages/scribe/ClassScoringPage";
import LoginPage from "../../pages/auth/LoginPage";
import HomePage from "../../pages/home/HomePage";
import NotFoundPage from "../../pages/common/NotFoundPage";
import {
  PrivacyPage,
  ResultsNoticePage,
  TermsPage,
} from "../../pages/legal/LegalPages";
function AppRouter() {
  return (
    <BrowserRouter>
      <AnalyticsRouteTracker />
      <AppMenu />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/results-notice" element={<ResultsNoticePage />} />
        <Route path="/public" element={<PublicAssociationsPage />} />
        <Route path="/admin/analytics" element={<PlatformAnalyticsPage />} />
        <Route
          path="/public/associations/:associationId"
          element={<PublicAssociationShowsPage />}
        />
        <Route
          path="/public/associations/:associationId/shows/:showId"
          element={<PublicResultsPage />}
        />
        <Route path="/associations" element={<AssociationsPage />} />
        <Route
          path="/associations/:associationId/shows"
          element={<AssociationShowPage />}
        />
        <Route
          path="/associations/:associationId/access"
          element={<AssociationAccessPage />}
        />
        <Route
          path="/associations/:associationId/activity"
          element={<AssociationActivityPage />}
        />
        <Route
          path="/associations/:associationId/settings"
          element={<AssociationSettingsPage />}
        />
        <Route
          path="/associations/:associationId/shows/:showId"
          element={<ShowDetailPage />}
        />
        <Route
          path="/associations/:associationId/shows/:showId/secretariat"
          element={<SecretariatDashboardPage />}
        />
        <Route
          path="/associations/:associationId/shows/:showId/time"
          element={<ShowTimeManagementPage />}
        />
        <Route
          path="/associations/:associationId/shows/:showId/announcer"
          element={<AnnouncerDashboardPage />}
        />
        <Route
          path="/associations/:associationId/shows/:showId/scribe"
          element={<ShowScribePage />}
        />
        <Route
          path="/associations/:associationId/shows/:showId/public"
          element={<PublicResultsPage />}
        />
        <Route
          path="/associations/:associationId/shows/:showId/days/:dayId"
          element={<DayClassesPage />}
        />
        <Route
          path="/associations/:associationId/classes/:classId/setup"
          element={<ClassSetupPage />}
        />
        <Route
          path="/associations/:associationId/shows/:showId/days/:dayId/paid-warmups/:paidWarmupId/setup"
          element={<PaidWarmupSetupPage />}
        />
        <Route
          path="/associations/:associationId/scribe/classes/:classId"
          element={<ClassScoringPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
