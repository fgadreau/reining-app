import React, { useEffect, useState } from "react";
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
import { appStyles as styles } from "../../styles/appStyles";

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") || "";
  const inviteEmail = searchParams.get("email") || "";
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (inviteEmail) {
      setEmail(inviteEmail);
    }

    if (inviteToken) {
      setMode("signup");
    }
  }, [inviteEmail, inviteToken]);

  async function redeemInvitations(user) {
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
  }

  function navigateAfterAuth(redeemed) {
    if (redeemed?.membership?.associationId) {
      navigate(`/associations/${redeemed.membership.associationId}/shows`);
      return;
    }

    navigate("/associations");
  }

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
        });

        if (data?.session && data?.user) {
          const redeemed = await redeemInvitations(data.user);
          navigateAfterAuth(redeemed);
          return;
        }

        setMessage(
          inviteToken
            ? "Compte créé. Si Supabase demande une confirmation, vérifie ton courriel, puis reviens avec ce lien pour te connecter."
            : "Compte créé. Si Supabase demande une confirmation, vérifie ton courriel avant de te connecter."
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
        <Link to="/associations" style={secondaryLinkStyle}>
          ← Associations
        </Link>
      </div>

      <section style={cardStyle}>
        <div style={eyebrowStyle}>Supabase</div>
        <h1 style={titleStyle}>
          {mode === "signup" ? "Créer un accès" : "Connexion"}
        </h1>
        <p style={subtitleStyle}>
          {inviteToken
            ? "Cree ton compte ou connecte-toi avec le courriel invite pour rejoindre l'association."
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
                onChange={(event) => setEmail(event.target.value)}
                placeholder="secretariat@example.com"
                style={inputStyle}
                autoComplete="email"
              />
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
