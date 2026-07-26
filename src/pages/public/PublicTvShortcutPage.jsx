import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPublicShowByTvCodeRepository } from "../../features/publication/publicViewRepository";
import {
  getRememberedTvDisplayShortcut,
  normalizeTvDisplayShortCode,
  rememberTvDisplayShortcut,
} from "../../features/tvDisplay/tvDisplayShortCode";

function PublicTvShortcutPage() {
  const { code: routeCode = "" } = useParams();
  const navigate = useNavigate();
  const [rememberedShortcut] = useState(() =>
    getRememberedTvDisplayShortcut()
  );
  const [code, setCode] = useState(
    () =>
      normalizeTvDisplayShortCode(routeCode) ||
      rememberedShortcut?.code ||
      ""
  );
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const automaticCodeRef = useRef("");

  const openTvDisplay = useCallback(
    async (value) => {
      const normalizedCode = normalizeTvDisplayShortCode(value);
      setCode(normalizedCode);

      if (normalizedCode.length !== 6) {
        setStatus("error");
        setMessage("Entrez les 6 caractères du code TV.");
        return;
      }

      setStatus("loading");
      setMessage("");

      const show = await getPublicShowByTvCodeRepository(normalizedCode);
      const associationId = String(show?.associationId || "").trim();
      const showId = String(show?.id || "").trim();

      if (!show || !associationId || !showId) {
        setStatus("error");
        setMessage(
          "Code introuvable. Vérifiez que le show est actif et que sa vitrine est publique."
        );
        return;
      }

      rememberTvDisplayShortcut({
        ...show,
        code: normalizedCode,
      });
      navigate(
        `/public/associations/${encodeURIComponent(
          associationId
        )}/shows/${encodeURIComponent(showId)}/tv`,
        { replace: true }
      );
    },
    [navigate]
  );

  useEffect(() => {
    const normalizedRouteCode = normalizeTvDisplayShortCode(routeCode);
    if (
      normalizedRouteCode.length !== 6 ||
      automaticCodeRef.current === normalizedRouteCode
    ) {
      return;
    }

    automaticCodeRef.current = normalizedRouteCode;
    openTvDisplay(normalizedRouteCode);
  }, [openTvDisplay, routeCode]);

  const isLoading = status === "loading";

  return (
    <main style={pageStyle} data-tv-shortcut-page>
      <div style={glowStyle} />
      <section style={cardStyle}>
        <div style={brandStyle}>ShowScore</div>
        <div style={eyebrowStyle}>Écran TV général / General TV display</div>
        <h1 style={titleStyle}>Ouvrir l’écran du show</h1>
        <p style={helpStyle}>
          Entrez le code affiché dans <strong>Réglages Live</strong>.
          <br />
          Enter the code shown in <strong>Live Settings</strong>.
        </p>

        <form
          style={formStyle}
          onSubmit={(event) => {
            event.preventDefault();
            openTvDisplay(code);
          }}
        >
          <label htmlFor="tv-display-code" style={labelStyle}>
            Code TV
          </label>
          <input
            id="tv-display-code"
            value={code}
            onChange={(event) => {
              setCode(normalizeTvDisplayShortCode(event.target.value));
              setStatus("idle");
              setMessage("");
            }}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={6}
            placeholder="ABC234"
            style={inputStyle}
            disabled={isLoading}
            autoFocus
          />
          <button
            type="submit"
            style={primaryButtonStyle(code.length === 6 && !isLoading)}
            disabled={code.length !== 6 || isLoading}
          >
            {isLoading
              ? "Ouverture… / Opening…"
              : "Ouvrir l’écran / Open display"}
          </button>
        </form>

        {message ? (
          <div style={errorStyle} role="alert">
            {message}
          </div>
        ) : null}

        {rememberedShortcut ? (
          <div style={rememberedStyle}>
            <div>
              <div style={rememberedLabelStyle}>
                Dernier écran / Last display
              </div>
              <strong style={rememberedNameStyle}>
                {rememberedShortcut.showName || rememberedShortcut.code}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => openTvDisplay(rememberedShortcut.code)}
              style={secondaryButtonStyle}
              disabled={isLoading}
            >
              Rouvrir / Reopen
            </button>
          </div>
        ) : null}

        <div style={footerStyle}>showscore.app/tv</div>
      </section>
    </main>
  );
}

const pageStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  overflow: "auto",
  boxSizing: "border-box",
  minHeight: "100vh",
  padding: "clamp(20px, 5vw, 72px)",
  display: "grid",
  placeItems: "center",
  background:
    "linear-gradient(135deg, #101820 0%, #1f2f35 52%, #111827 100%)",
  color: "#f8fafc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
};

const glowStyle = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  background:
    "radial-gradient(circle at 20% 16%, rgba(244, 217, 140, 0.18), transparent 34%), radial-gradient(circle at 82% 78%, rgba(94, 234, 212, 0.16), transparent 36%)",
};

const cardStyle = {
  position: "relative",
  width: "min(100%, 660px)",
  boxSizing: "border-box",
  padding: "clamp(24px, 4vw, 48px)",
  borderRadius: 20,
  border: "1px solid rgba(244, 217, 140, 0.42)",
  background: "rgba(15, 23, 42, 0.86)",
  boxShadow: "0 28px 70px rgba(0, 0, 0, 0.38)",
  display: "grid",
  gap: 16,
  textAlign: "center",
};

const brandStyle = {
  color: "#5eead4",
  fontSize: "clamp(22px, 3vw, 34px)",
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const eyebrowStyle = {
  color: "#f4d98c",
  fontSize: "clamp(12px, 1.5vw, 16px)",
  fontWeight: 900,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: 0,
  fontSize: "clamp(30px, 5vw, 52px)",
  lineHeight: 1.02,
};

const helpStyle = {
  margin: 0,
  color: "#cbd5e1",
  fontSize: "clamp(15px, 2vw, 19px)",
  lineHeight: 1.45,
};

const formStyle = {
  display: "grid",
  gap: 12,
  marginTop: 6,
};

const labelStyle = {
  color: "#f4d98c",
  fontSize: 15,
  fontWeight: 900,
  textTransform: "uppercase",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "2px solid rgba(94, 234, 212, 0.62)",
  borderRadius: 12,
  background: "#ffffff",
  color: "#0f172a",
  padding: "14px 18px",
  fontSize: "clamp(34px, 7vw, 56px)",
  fontWeight: 950,
  letterSpacing: "0.18em",
  textAlign: "center",
  textTransform: "uppercase",
  outline: "none",
};

const primaryButtonStyle = (enabled) => ({
  border: 0,
  borderRadius: 12,
  padding: "15px 20px",
  background: enabled ? "#f4d98c" : "#475569",
  color: enabled ? "#111827" : "#cbd5e1",
  fontSize: "clamp(16px, 2vw, 20px)",
  fontWeight: 950,
  cursor: enabled ? "pointer" : "not-allowed",
});

const errorStyle = {
  padding: "12px 14px",
  borderRadius: 10,
  background: "rgba(248, 113, 113, 0.14)",
  border: "1px solid rgba(248, 113, 113, 0.48)",
  color: "#fecaca",
  fontWeight: 800,
};

const rememberedStyle = {
  marginTop: 4,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(148, 163, 184, 0.3)",
  background: "rgba(255, 255, 255, 0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  textAlign: "left",
};

const rememberedLabelStyle = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const rememberedNameStyle = {
  display: "block",
  marginTop: 3,
  color: "#f8fafc",
  fontSize: 17,
};

const secondaryButtonStyle = {
  flexShrink: 0,
  border: "1px solid rgba(94, 234, 212, 0.48)",
  borderRadius: 9,
  padding: "10px 12px",
  background: "rgba(94, 234, 212, 0.1)",
  color: "#ccfbf1",
  fontWeight: 900,
  cursor: "pointer",
};

const footerStyle = {
  marginTop: 4,
  color: "#5eead4",
  fontSize: 14,
  fontWeight: 900,
};

export default PublicTvShortcutPage;

