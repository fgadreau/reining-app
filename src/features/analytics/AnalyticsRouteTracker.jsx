import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthUser } from "../auth/useAuthUser";
import { useTranslation } from "../i18n/I18nProvider";
import { APP_EVENT_TYPES, trackEvent } from "./analyticsRepository";
import { getPageEventContext } from "./analyticsRouteContext";

function AnalyticsRouteTracker() {
  const location = useLocation();
  const auth = useAuthUser();
  const { language } = useTranslation();

  useEffect(() => {
    if (auth.isLoading) {
      return;
    }

    const context = getPageEventContext(location.pathname);

    trackEvent({
      eventName: "page_view",
      eventType: APP_EVENT_TYPES.ANALYTICS,
      associationId: context.associationId,
      showId: context.showId,
      dayId: context.dayId,
      classId: context.classId,
      path: `${location.pathname}${location.search}`,
      locale: language,
      metadata: {
        pageCategory: context.pageCategory,
        isPublicPath: context.isPublicPath,
        isAuthenticated: auth.isAuthenticated,
      },
    });
  }, [
    auth.isAuthenticated,
    auth.isLoading,
    auth.user?.id,
    language,
    location.pathname,
    location.search,
  ]);

  return null;
}

export default AnalyticsRouteTracker;
