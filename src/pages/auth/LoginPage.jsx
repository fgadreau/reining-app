import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  isAuthAvailable,
  signInWithLocalTestUser,
  signInWithEmail,
  signUpWithEmail,
} from "../../features/auth/authRepository";
import {
  LOCAL_TEST_EMAIL,
  LOCAL_TEST_PASSWORD,
  isLocalTestAuthAvailable,
} from "../../features/auth/localTestAuth";
import {
  redeemAssociationInvitationRepository,
  redeemPendingAssociationInvitationsRepository,
} from "../../features/auth/invitationRepository";
import {
  APP_EVENT_TYPES,
  trackEvent,
} from "../../features/analytics/analyticsRepository";
import { useAuthUser } from "../../features/auth/useAuthUser";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

const LEGAL_VERSION = "2026-05-26";

function sanitizeNextPath(value) {
  const text = String(value || "").trim();

  if (!text || !text.startsWith("/") || text.startsWith("//")) {
    return "";
  }

  return text;
}

function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuthUser();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") || "";
  const inviteEmail = searchParams.get("email") || "";
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const hasLockedInviteEmail = Boolean(inviteToken && inviteEmail);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoAcceptingInvitation, setIsAutoAcceptingInvitation] =
    useState(false);
  const [autoAcceptError, setAutoAcceptError] = useState("");
  const [autoAcceptAttempt, setAutoAcceptAttempt] = useState(0);
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const autoRedeemKeyRef = useRef("");
  const redeemInFlightRef = useRef(null);
  const inviteEmailNormalized = normalizeEmail(inviteEmail);
  const authEmailNormalized = normalizeEmail(auth.user?.email);
  const hasInviteSessionMismatch = Boolean(
    inviteToken &&
      inviteEmailNormalized &&
      authEmailNormalized &&
      inviteEmailNormalized !== authEmailNormalized
  );
  const isAcceptingAuthenticatedInvite = Boolean(
    inviteToken && auth.user && !hasInviteSessionMismatch
  );
  const canUseLocalTestLogin = isAuthAvailable() && isLocalTestAuthAvailable();

  useEffect(() => {
    if (inviteEmail) {
      setEmail(inviteEmail);
    }

    if (inviteToken) {
      setMode("signup");
    }
  }, [inviteEmail, inviteToken]);

  const redeemInvitations = useCallback(async (user) => {
    if (!user) {
      return null;
    }

    const redeemKey = `${inviteToken || "pending"}:${user.id}`;
    if (redeemInFlightRef.current?.key === redeemKey) {
      return redeemInFlightRef.current.promise;
    }

    const redeemPromise = (async () => {
      if (inviteToken) {
        const redeemedInvitation = await withTimeout(
          redeemAssociationInvitationRepository({
            token: inviteToken,
            user,
          }),
          t("login.invitationAcceptTimeout")
        );

        if (!redeemedInvitation) {
          throw new Error(t("login.invitationAcceptFailed"));
        }

        return redeemedInvitation;
      }

      const redeemed = await withTimeout(
        redeemPendingAssociationInvitationsRepository(user),
        t("login.pendingInvitesTimeout")
      );
      return redeemed[0] || null;
    })();

    redeemInFlightRef.current = {
      key: redeemKey,
      promise: redeemPromise,
    };

    try {
      return await redeemPromise;
    } finally {
      if (redeemInFlightRef.current?.key === redeemKey) {
        redeemInFlightRef.current = null;
      }
    }
  }, [inviteToken, t]);

  const navigateAfterAuth = useCallback((redeemed) => {
    if (nextPath) {
      navigate(nextPath);
      return;
    }

    if (redeemed?.membership?.associationId) {
      navigate(`/associations/${redeemed.membership.associationId}/shows`);
      return;
    }

    navigate("/associations");
  }, [navigate, nextPath]);

  useEffect(() => {
    if (!inviteToken || !auth.user) {
      return;
    }

    if (hasInviteSessionMismatch) {
      setMessage(
        t("login.inviteSessionMismatch", {
          currentEmail: auth.user.email,
          inviteEmail,
        })
      );
      return;
    }

    const autoRedeemKey = `${inviteToken}:${auth.user.id}:${autoAcceptAttempt}`;
    if (autoRedeemKeyRef.current === autoRedeemKey) {
      return;
    }
    autoRedeemKeyRef.current = autoRedeemKey;

    let isMounted = true;

    async function autoRedeemInvitation() {
      setAutoAcceptError("");
      setIsAutoAcceptingInvitation(true);
      setIsSubmitting(true);
      setMessage(t("login.acceptingInvitation"));

      try {
        const redeemed = await redeemInvitations(auth.user);

        if (!isMounted) return;
        navigateAfterAuth(redeemed);
      } catch (error) {
        if (!isMounted) return;
        const nextMessage =
          error.message || t("login.invitationAcceptFailed");
        setAutoAcceptError(nextMessage);
        setMessage(nextMessage);
      } finally {
        if (isMounted) {
          setIsAutoAcceptingInvitation(false);
          setIsSubmitting(false);
        }
      }
    }

    autoRedeemInvitation();

    return () => {
      isMounted = false;
    };
  }, [
    autoAcceptAttempt,
    auth.user,
    hasInviteSessionMismatch,
    inviteEmail,
    inviteToken,
    navigateAfterAuth,
    redeemInvitations,
    t,
  ]);

  function handleRetryInvitationAccept() {
    setAutoAcceptError("");
    setMessage("");
    setAutoAcceptAttempt((attempt) => attempt + 1);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage(t("login.missingCredentials"));
      return;
    }

    if (mode === "signup" && !hasAcceptedLegal) {
      setMessage(t("login.legalRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      trackEvent({
        eventName: mode === "signup" ? "auth_signup_attempt" : "auth_signin_attempt",
        eventType: APP_EVENT_TYPES.AUDIT,
        metadata: {
          email: normalizeEmail(email),
          hasInviteToken: Boolean(inviteToken),
        },
      });

      if (hasInviteSessionMismatch) {
        setMessage(
          t("login.inviteSessionMismatchSubmit", {
            currentEmail: auth.user.email,
            inviteEmail,
          })
        );
        return;
      }

      if (inviteToken && auth.user && !hasInviteSessionMismatch) {
        const redeemed = await redeemInvitations(auth.user);
        navigateAfterAuth(redeemed);
        return;
      }

      if (mode === "signup") {
        const data = await signUpWithEmail({
          email: email.trim(),
          password,
          metadata: {
            accepted_legal_at: new Date().toISOString(),
            accepted_legal_version: LEGAL_VERSION,
          },
          emailRedirectTo:
            typeof window === "undefined"
              ? undefined
              : inviteToken
                ? window.location.href
                : `${window.location.origin}/login${
                    nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""
                  }`,
        });

        if (data?.session && data?.user) {
          trackEvent({
            eventName: "auth_signup_success",
            eventType: APP_EVENT_TYPES.AUDIT,
            metadata: {
              email: normalizeEmail(data.user.email || email),
              hasInviteToken: Boolean(inviteToken),
            },
          });
          const redeemed = await redeemInvitations(data.user);
          navigateAfterAuth(redeemed);
          return;
        }

        setMessage(
          inviteToken
            ? t("login.accountCreatedInvite")
            : t("login.accountCreated")
        );
        trackEvent({
          eventName: "auth_signup_submitted",
          eventType: APP_EVENT_TYPES.AUDIT,
          metadata: {
            email: normalizeEmail(email),
            hasInviteToken: Boolean(inviteToken),
          },
        });
      } else {
        const data = await signInWithEmail({
          email: email.trim(),
          password,
        });
        trackEvent({
          eventName: "auth_signin_success",
          eventType: APP_EVENT_TYPES.AUDIT,
          metadata: {
            email: normalizeEmail(data?.user?.email || email),
            hasInviteToken: Boolean(inviteToken),
          },
        });
        const redeemed = await redeemInvitations(data?.user);
        navigateAfterAuth(redeemed);
      }
    } catch (error) {
      trackEvent({
        eventName: mode === "signup" ? "auth_signup_failed" : "auth_signin_failed",
        eventType: APP_EVENT_TYPES.AUDIT,
        metadata: {
          email: normalizeEmail(email),
          hasInviteToken: Boolean(inviteToken),
          message: error?.message || "",
        },
      });
      setMessage(error.message || t("login.signInFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLocalTestLogin() {
    setMessage("");
    setIsSubmitting(true);

    try {
      await signInWithLocalTestUser();
      trackEvent({
        eventName: "auth_local_test_signin",
        eventType: APP_EVENT_TYPES.AUDIT,
        metadata: {
          email: LOCAL_TEST_EMAIL,
        },
      });
      navigate(nextPath || "/associations");
    } catch (error) {
      setMessage(error.message || t("login.localTestFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/" style={secondaryLinkStyle}>
          {t("login.backHome")}
        </Link>
      </div>

      <section style={cardStyle}>
        <div style={eyebrowStyle}>Supabase</div>
        <h1 style={titleStyle}>
          {isAcceptingAuthenticatedInvite
            ? t("login.finalizeInviteTitle")
            : mode === "signup"
              ? t("login.titleSignUp")
              : t("login.titleSignIn")}
        </h1>
        <p style={subtitleStyle}>
          {isAcceptingAuthenticatedInvite
            ? t("login.finalizeInviteSubtitle")
            : inviteToken
              ? t("login.inviteSubtitle")
              : t("login.defaultSubtitle")}
        </p>

        {inviteToken && !isAcceptingAuthenticatedInvite && (
          <div style={inviteNoticeStyle}>
            {t("login.inviteNotice")}
          </div>
        )}

        {canUseLocalTestLogin && (
          <div style={localTestBoxStyle}>
            <div style={localTestTitleStyle}>{t("login.localTestTitle")}</div>
            <div style={helperTextStyle}>
              {t("login.localTestDescription")}
            </div>
            <div style={localTestCredentialsStyle}>
              {LOCAL_TEST_EMAIL} / {LOCAL_TEST_PASSWORD}
            </div>
            <button
              type="button"
              onClick={handleLocalTestLogin}
              style={secondaryButtonStyle}
              disabled={isSubmitting}
            >
              {t("login.localTestButton")}
            </button>
          </div>
        )}

        {!isAuthAvailable() ? (
          <div style={warningStyle}>
            {t("login.supabaseMissing")}
          </div>
        ) : isAcceptingAuthenticatedInvite ? (
          <div style={acceptanceBoxStyle}>
            <div style={acceptanceTitleStyle}>
              {isAutoAcceptingInvitation
                ? t("login.acceptingInvitation")
                : autoAcceptError
                  ? t("login.invitationAcceptFailed")
                  : t("login.acceptingInvitation")}
            </div>
            <div style={helperTextStyle}>
              {t("login.invitationSignedInAs", {
                email: auth.user.email || inviteEmail,
              })}
            </div>
            {message && <div style={messageStyle}>{message}</div>}
            {autoAcceptError && (
              <button
                type="button"
                onClick={handleRetryInvitationAccept}
                style={primaryButtonStyle}
                disabled={isSubmitting}
              >
                {t("login.invitationRetryButton")}
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={formStyle}>
            <label style={labelStyle}>
              <span>{t("login.emailLabel")}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  if (!hasLockedInviteEmail) {
                    setEmail(event.target.value);
                  }
                }}
                placeholder="secretariat@example.com"
                style={{
                  ...inputStyle,
                  background: hasLockedInviteEmail ? "#f8fafc" : "#fff",
                }}
                autoComplete="email"
                readOnly={hasLockedInviteEmail}
              />
              {hasLockedInviteEmail && (
                <span style={helperTextStyle}>
                  {t("login.inviteEmailHelper")}
                </span>
              )}
            </label>

            <label style={labelStyle}>
              <span>{t("login.passwordLabel")}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("login.passwordPlaceholder")}
                style={inputStyle}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
              />
            </label>

            {mode === "signup" && (
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={hasAcceptedLegal}
                  onChange={(event) =>
                    setHasAcceptedLegal(event.target.checked)
                  }
                />
                <span>
                  {t("login.acceptLegalStart")}{" "}
                  <Link to="/terms" style={inlineLinkStyle}>
                    {t("login.termsLink")}
                  </Link>
                  {t("login.acceptLegalPrivacyJoin")}{" "}
                  <Link to="/privacy" style={inlineLinkStyle}>
                    {t("login.privacyPolicyLink")}
                  </Link>{" "}
                  {t("login.acceptLegalResultsJoin")}
                  <Link to="/results-notice" style={inlineLinkStyle}>
                    {t("login.resultsNoticeLink")}
                  </Link>
                  {t("login.acceptLegalEnd")}
                </span>
              </label>
            )}

            {message && <div style={messageStyle}>{message}</div>}

            <div style={buttonRowStyle}>
              <button
                type="submit"
                style={primaryButtonStyle}
                disabled={isSubmitting}
              >
                {mode === "signup"
                  ? t("login.createAccountButton")
                  : t("login.signInButton")}
              </button>

              <button
                type="button"
                onClick={() =>
                  setMode((current) =>
                    current === "signup" ? "signin" : "signup"
                  )
                }
                style={secondaryButtonStyle}
                disabled={isSubmitting}
              >
                {mode === "signup"
                  ? t("login.haveAccountButton")
                  : t("login.createAccountModeButton")}
              </button>
            </div>
          </form>
        )}
      </section>

      <div style={legalLinksStyle}>
        <Link to="/terms" style={inlineLinkStyle}>
          {t("home.terms")}
        </Link>
        <span>·</span>
        <Link to="/privacy" style={inlineLinkStyle}>
          {t("home.privacy")}
        </Link>
        <span>·</span>
        <Link to="/results-notice" style={inlineLinkStyle}>
          {t("home.resultsNotice")}
        </Link>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  maxWidth: 560,
};

const eyebrowStyle = {
  color: "#64748b",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: 12,
  letterSpacing: 0,
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 28,
};

const subtitleStyle = {
  color: "#64748b",
  marginTop: 0,
};

const formStyle = {
  display: "grid",
  gap: 14,
  marginTop: 18,
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const helperTextStyle = {
  color: "#64748b",
  fontSize: 13,
  fontWeight: 500,
};

const buttonRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const checkboxLabelStyle = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  color: "#334155",
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.4,
};

const inlineLinkStyle = {
  color: "#1d4ed8",
  fontWeight: 700,
  textDecoration: "none",
};

const legalLinksStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
  maxWidth: 560,
  marginTop: 14,
  color: "#64748b",
  fontSize: 13,
};

const primaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
};

const secondaryLinkStyle = {
  ...secondaryButtonStyle,
  display: "inline-flex",
  textDecoration: "none",
};

const messageStyle = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 8,
  padding: 10,
};

const warningStyle = {
  border: "1px solid #fdba74",
  background: "#fff7ed",
  color: "#9a3412",
  borderRadius: 8,
  padding: 12,
  marginTop: 16,
};

const inviteNoticeStyle = {
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  borderRadius: 8,
  padding: 12,
  marginTop: 16,
};

const localTestBoxStyle = {
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  borderRadius: 8,
  padding: 12,
  marginTop: 16,
  display: "grid",
  gap: 8,
};

const localTestTitleStyle = {
  color: "#0f172a",
  fontWeight: 800,
};

const localTestCredentialsStyle = {
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
  fontFamily: "monospace",
};

const acceptanceBoxStyle = {
  display: "grid",
  gap: 12,
  marginTop: 18,
  padding: 14,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 8,
};

const acceptanceTitleStyle = {
  color: "#1e3a8a",
  fontWeight: 800,
};

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function withTimeout(promise, timeoutMessage, timeoutMs = 20000) {
  let timeoutId;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export default LoginPage;
