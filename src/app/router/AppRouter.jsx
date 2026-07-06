import React, { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import AppMenu from "../../components/AppMenu";
import PublicAppInstallPrompt from "../../components/PublicAppInstallPrompt";
import AnalyticsRouteTracker from "../../features/analytics/AnalyticsRouteTracker";
import { dispatchAppRouteChanged } from "../../features/pwa/appUpdateSafety";
import ShowScoreAssociationGate from "./ShowScoreAssociationGate";
import PlatformAnalyticsPage from "../../pages/admin/PlatformAnalyticsPage";
import AssociationsPage from "../../pages/association/AssociationsPage";
import AssociationShowPage from "../../pages/association/AssociationShowPage";
import AssociationAccessPage from "../../pages/association/AssociationAccessPage";
import AssociationActivityPage from "../../pages/association/AssociationActivityPage";
import AssociationSettingsPage from "../../pages/association/AssociationSettingsPage";
import AssociationChampionshipPage from "../../pages/association/AssociationChampionshipPage";
import ShowDetailPage from "../../pages/association/ShowDetailPage";
import SecretariatDashboardPage from "../../pages/association/SecretariatDashboardPage";
import AnnouncerDashboardPage from "../../pages/association/AnnouncerDashboardPage";
import ShowScribePage from "../../pages/association/ShowScribePage";
import PublicResultsPage from "../../pages/association/PublicResultsPage";
import PublicAssociationsPage from "../../pages/public/PublicAssociationsPage";
import PublicAssociationShowsPage from "../../pages/public/PublicAssociationShowsPage";
import PublicAssociationChampionshipPage from "../../pages/public/PublicAssociationChampionshipPage";
import PublicShowOverlayPage from "../../pages/public/PublicShowOverlayPage";
import PublicShowTvPage from "../../pages/public/PublicShowTvPage";
import ShowSchedulePreviewPage from "../../pages/association/ShowSchedulePreviewPage";
import ShowTimeManagementPage from "../../pages/association/ShowTimeManagementPage";
import DayClassesPage from "../../pages/association/DayClassesPage";
import ClassSetupPage from "../../pages/association/ClassSetupPage";
import PaidWarmupSetupPage from "../../pages/association/PaidWarmupSetupPage";
import ClassScoringPage from "../../pages/scribe/ClassScoringPage";
import LoginPage from "../../pages/auth/LoginPage";
import RoleEntryPage from "../../pages/RoleEntryPage";
import HomePage from "../../pages/home/HomePage";
import AppPresentationPage from "../../pages/home/AppPresentationPage";
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
      <AppRouteChangeNotifier />
      <AppMenu />
      <PublicAppInstallPrompt />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/presentation" element={<AppPresentationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/go/:roleKey" element={<RoleEntryPage />} />
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
          path="/public/associations/:associationId/championnat"
          element={<PublicAssociationChampionshipPage />}
        />
        <Route
          path="/public/associations/:associationId/shows/:showId"
          element={<PublicResultsPage />}
        />
        <Route
          path="/public/associations/:associationId/shows/:showId/overlay"
          element={<PublicShowOverlayPage />}
        />
        <Route
          path="/public/associations/:associationId/shows/:showId/tv"
          element={<PublicShowTvPage />}
        />
        <Route path="/associations" element={<AssociationsPage />} />
        <Route
          path="/associations/:associationId/shows"
          element={
            <ShowScoreAssociationGate>
              <AssociationShowPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/access"
          element={
            <ShowScoreAssociationGate>
              <AssociationAccessPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/activity"
          element={
            <ShowScoreAssociationGate>
              <AssociationActivityPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/settings"
          element={
            <ShowScoreAssociationGate>
              <AssociationSettingsPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/championship"
          element={
            <ShowScoreAssociationGate>
              <AssociationChampionshipPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/shows/:showId"
          element={
            <ShowScoreAssociationGate>
              <ShowDetailPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/shows/:showId/secretariat"
          element={
            <ShowScoreAssociationGate>
              <SecretariatDashboardPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/shows/:showId/time"
          element={
            <ShowScoreAssociationGate>
              <ShowTimeManagementPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/shows/:showId/schedule"
          element={
            <ShowScoreAssociationGate>
              <ShowSchedulePreviewPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/shows/:showId/announcer"
          element={
            <ShowScoreAssociationGate>
              <AnnouncerDashboardPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/shows/:showId/scribe"
          element={
            <ShowScoreAssociationGate>
              <ShowScribePage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/shows/:showId/public"
          element={
            <ShowScoreAssociationGate>
              <PublicResultsPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/shows/:showId/days/:dayId"
          element={
            <ShowScoreAssociationGate>
              <DayClassesPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/classes/:classId/setup"
          element={
            <ShowScoreAssociationGate>
              <ClassSetupPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/shows/:showId/days/:dayId/paid-warmups/:paidWarmupId/setup"
          element={
            <ShowScoreAssociationGate>
              <PaidWarmupSetupPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route
          path="/associations/:associationId/scribe/classes/:classId"
          element={
            <ShowScoreAssociationGate>
              <ClassScoringPage />
            </ShowScoreAssociationGate>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function AppRouteChangeNotifier() {
  const location = useLocation();

  useEffect(() => {
    dispatchAppRouteChanged(location.pathname);
  }, [location.pathname]);

  return null;
}

export default AppRouter;
