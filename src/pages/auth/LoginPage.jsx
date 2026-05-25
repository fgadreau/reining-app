import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  isAuthAvailable,
  signInWithEmail,
  signUpWithEmail,
} from "../../features/auth/authRepository";
import {
  redeemAssociationInvitationRepository,
  redeemPendingAssociationInvitationsRepository,
} from "../../features/auth/invitationRepository";
import { useAuthUser } from "../../features/auth/useAuthUser";
import { appStyles as styles } from "../../styles/appStyles";

function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuthUser();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") || "";
  const inviteEmail = searchParams.get("email") || "";
  const hasLockedInviteEmail = Boolean(inviteToken && inviteEmail);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasTriedAutoRedeemRef = useRef(false);

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

    if (inviteToken) {
      return redeemAssociationInvitationRepository({
        token: inviteToken,
        user,
      });
    }

    const redeemed = await redeemPendingAssociationInvitationsRepository(user);
    return redeemed[0] || null;
  }, [inviteToken]);

  const navigateAfterAuth = useCallback((redeemed) => {
    if (redeemed?.membership?.associationId) {
      navigate(`/associations/${redeemed.membership.associationId}/shows`);
      return;
    }

    navigate("/associations");
  }, [navigate]);

  useEffect(() => {
    if (!inviteToken || !auth.user || hasTriedAutoRedeemRef.current) {
      return;
    }

    let isMounted = true;

    async function autoRedeemInvitation() {
      hasTriedAutoRedeemRef.current = true;
      setIsSubmitting(true);
      setMessage("Acceptation de l'invitation en cours...");

      try {
        const redeemed = await redeemInvitations(auth.user);

        if (!isMounted) return;
        navigateAfterAuth(redeemed);
      } catch (error) {
        if (!isMounted) return;
        setMessage(error.message || "Invitation impossible à accepter.");
      } finally {
        if (isMounted) {
          setIsSubmitting(false);
        }
      }
    }

    autoRedeemInvitation();

    return () => {
      isMounted = false;
    };
  }, [
    auth.user,
    inviteToken,
    navigateAfterAuth,
    redeemInvitations,
  ]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("Entre ton courriel et ton mot de passe.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const data = await signUpWithEmail({
          email: email.trim(),
          password,
          emailRedirectTo:
            typeof window === "undefined"
              ? undefined
              : inviteToken
                ? window.location.href
                : `${window.location.origin}/login`,
        });

        if (data?.session && data?.user) {
          const redeemed = await redeemInvitations(data.user);
          navigateAfterAuth(redeemed);
          return;
        }

        setMessage(
          inviteToken
            ? "Compte créé. Vérifie ton courriel. Le lien de confirmation devrait te ramener ici pour accepter l'invitation."
            : "Compte créé. Vérifie ton courriel, puis reviens te connecter."
        );
      } else {
        const data = await signInWithEmail({
          email: email.trim(),
          password,
        });
        const redeemed = await redeemInvitations(data?.user);
        navigateAfterAuth(redeemed);
      }
    } catch (error) {
      setMessage(error.message || "Connexion impossible.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/" style={secondaryLinkStyle}>
          ← Accueil
        </Link>
      </div>

      <section style={cardStyle}>
        <div style={eyebrowStyle}>Supabase</div>
        <h1 style={titleStyle}>
          {mode === "signup" ? "Créer un accès" : "Connexion"}
        </h1>
        <p style={subtitleStyle}>
          {inviteToken
            ? "Crée ton compte ou connecte-toi avec le courriel invité pour rejoindre l'association."
            : "Connecte le poste du secrétariat ou du scribe pour écrire dans le cloud."}
        </p>

        {inviteToken && (
          <div style={inviteNoticeStyle}>
            Invitation détectée. Utilise le courriel invité pour accepter
            automatiquement l'accès après la connexion.
          </div>
        )}

        {!isAuthAvailable() ? (
          <div style={warningStyle}>
            Supabase n’est pas configuré. Ajoute les variables dans `.env.local`,
            puis redémarre `npm start`.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={formStyle}>
            <label style={labelStyle}>
              <span>Courriel</span>
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
                  Ce courriel vient du lien d'invitation.
                </span>
              )}
            </label>

            <label style={labelStyle}>
              <span>Mot de passe</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mot de passe"
                style={inputStyle}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
              />
            </label>

            {message && <div style={messageStyle}>{message}</div>}

            <div style={buttonRowStyle}>
              <button
                type="submit"
                style={primaryButtonStyle}
                disabled={isSubmitting}
              >
                {mode === "signup" ? "Créer le compte" : "Se connecter"}
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
                {mode === "signup" ? "J’ai déjà un compte" : "Créer un compte"}
              </button>
            </div>
          </form>
        )}
      </section>
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

export default LoginPage;
