import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "../features/i18n/I18nProvider";
import { canReloadForAppUpdate } from "../features/pwa/appUpdateSafety";

const INSTALL_DISMISS_KEY = "showscore.publicInstallPromptDismissed";
const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const PUBLIC_OVERLAY_PATH_PATTERN =
  /^\/public\/associations\/[^/]+\/shows\/[^/]+\/overlay/;

function getPublicAssetPath(path) {
  const publicUrl = import.meta.env.BASE_URL || "";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${publicUrl}${normalizedPath}`;
}

function isStandaloneDisplay() {
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator?.standalone
  );
}

function isIosDevice() {
  const navigator = window.navigator || {};
  return Boolean(
    /iphone|ipad|ipod/i.test(navigator.userAgent || "") ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function getStoredInstallDismissed() {
  try {
    const value = Number(window.localStorage.getItem(INSTALL_DISMISS_KEY));
    return Number.isFinite(value) && value > Date.now();
  } catch (error) {
    return false;
  }
}

function setStoredInstallDismissed() {
  try {
    window.localStorage.setItem(
      INSTALL_DISMISS_KEY,
      String(Date.now() + INSTALL_SNOOZE_MS)
    );
  } catch (error) {
    // Local storage can be unavailable in private browsing.
  }
}

function PublicAppInstallPrompt() {
  const { t } = useTranslation();
  const location = useLocation();
  const initialManifestSignatureRef = useRef(null);
  const isReloadingForUpdateRef = useRef(false);
  const hasDeferredManifestUpdateRef = useRef(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState(() =>
    getStoredInstallDismissed()
  );
  const [canShowIosInstall, setCanShowIosInstall] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    setCanShowIosInstall(isIosDevice() && !isStandaloneDisplay());

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setIsInstallDismissed(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    function reloadForFreshBuild() {
      if (!isMounted || isReloadingForUpdateRef.current) {
        return;
      }

      if (!canReloadForAppUpdate()) {
        hasDeferredManifestUpdateRef.current = true;
        return;
      }

      isReloadingForUpdateRef.current = true;
      window.location.reload();
    }

    async function checkForFreshBuild() {
      try {
        const response = await fetch(
          `${getPublicAssetPath("/asset-manifest.json")}?v=${Date.now()}`,
          { cache: "no-store" }
        );

        if (!response.ok) return;

        const manifest = await response.json();
        const signature =
          manifest?.files?.["main.js"] ||
          manifest?.entrypoints?.join("|") ||
          "";

        if (!signature) return;

        if (!initialManifestSignatureRef.current) {
          initialManifestSignatureRef.current = signature;
          return;
        }

        if (signature !== initialManifestSignatureRef.current && isMounted) {
          reloadForFreshBuild();
        }
      } catch (error) {
        // The manifest is only available in production builds.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkForFreshBuild();
      }
    }

    checkForFreshBuild();
    const interval = window.setInterval(checkForFreshBuild, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (
      !hasDeferredManifestUpdateRef.current ||
      isReloadingForUpdateRef.current ||
      !canReloadForAppUpdate(location.pathname)
    ) {
      return;
    }

    isReloadingForUpdateRef.current = true;
    window.location.reload();
  }, [location.pathname]);

  const canInstall =
    !isInstallDismissed &&
    !isStandaloneDisplay() &&
    (Boolean(installPrompt) || canShowIosInstall);

  if (
    PUBLIC_OVERLAY_PATH_PATTERN.test(location.pathname) ||
    !canInstall
  ) {
    return null;
  }

  async function handleInstall() {
    if (!installPrompt) {
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);

      if (choice?.outcome !== "accepted") {
        setIsInstallDismissed(true);
        setStoredInstallDismissed();
      }
    } catch (error) {
      console.error("Installation ShowScore impossible:", error);
    }
  }

  function dismissInstall() {
    setIsInstallDismissed(true);
    setStoredInstallDismissed();
  }

  return (
    <aside style={promptStyle}>
      <div style={promptSectionStyle}>
        <div>
          <div style={promptTitleStyle}>{t("public.appPrompt.installTitle")}</div>
          <div style={promptTextStyle}>
            {installPrompt
              ? t("public.appPrompt.installText")
              : t("public.appPrompt.iosInstallText")}
          </div>
        </div>
        <div style={actionRowStyle}>
          {installPrompt ? (
            <button type="button" onClick={handleInstall} style={primaryButtonStyle}>
              {t("public.appPrompt.install")}
            </button>
          ) : null}
          <button type="button" onClick={dismissInstall} style={secondaryButtonStyle}>
            {t("public.appPrompt.later")}
          </button>
        </div>
      </div>
    </aside>
  );
}

const promptStyle = {
  position: "fixed",
  right: 16,
  bottom: 16,
  zIndex: 1200,
  width: "min(420px, calc(100vw - 32px))",
  display: "grid",
  gap: 8,
};

const promptSectionStyle = {
  background: "#fff",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: 12,
  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
  display: "grid",
  gap: 10,
};

const promptTitleStyle = {
  fontWeight: 900,
  color: "#0f172a",
};

const promptTextStyle = {
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.4,
  marginTop: 3,
};

const actionRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const primaryButtonStyle = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const secondaryButtonStyle = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
  fontWeight: 800,
};

export default PublicAppInstallPrompt;
