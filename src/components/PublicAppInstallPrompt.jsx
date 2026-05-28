import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "../features/i18n/I18nProvider";

const INSTALL_DISMISS_KEY = "showscore.publicInstallPromptDismissed";

function getPublicAssetPath(path) {
  const publicUrl = process.env.PUBLIC_URL || "";
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
    return window.localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function setStoredInstallDismissed() {
  try {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
  } catch (error) {
    // Local storage can be unavailable in private browsing.
  }
}

function PublicAppInstallPrompt() {
  const { t } = useTranslation();
  const initialManifestSignatureRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState(() =>
    getStoredInstallDismissed()
  );
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
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
          setIsUpdateAvailable(true);
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

    function handleServiceWorkerUpdate() {
      setIsUpdateAvailable(true);
    }

    checkForFreshBuild();
    const interval = window.setInterval(checkForFreshBuild, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("showscore:update-available", handleServiceWorkerUpdate);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(
        "showscore:update-available",
        handleServiceWorkerUpdate
      );
    };
  }, []);

  const canInstall =
    !isInstallDismissed &&
    !isStandaloneDisplay() &&
    (Boolean(installPrompt) || canShowIosInstall);

  if (!isUpdateAvailable && !canInstall) {
    return null;
  }

  async function handleInstall() {
    if (!installPrompt) {
      return;
    }

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      setIsInstallDismissed(true);
      setStoredInstallDismissed();
    } catch (error) {
      console.error("Installation ShowScore impossible:", error);
    }
  }

  function dismissInstall() {
    setIsInstallDismissed(true);
    setStoredInstallDismissed();
  }

  function reloadApp() {
    window.location.reload();
  }

  return (
    <aside style={promptStyle}>
      {isUpdateAvailable ? (
        <div style={promptSectionStyle}>
          <div>
            <div style={promptTitleStyle}>{t("public.appPrompt.updateTitle")}</div>
            <div style={promptTextStyle}>{t("public.appPrompt.updateText")}</div>
          </div>
          <button type="button" onClick={reloadApp} style={primaryButtonStyle}>
            {t("public.appPrompt.reload")}
          </button>
        </div>
      ) : null}

      {canInstall ? (
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
      ) : null}
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
