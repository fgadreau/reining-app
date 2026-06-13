import React from "react";
import { appStyles as styles } from "../../styles/appStyles";

function ShowScoreNotEnabled({ associationName }) {
  return (
    <div style={styles.app}>
      <div style={containerStyle}>
        <div aria-hidden="true" style={lockIconStyle}>
          <span style={lockShackleStyle} />
          <span style={lockBodyStyle} />
        </div>
        <h2 style={titleStyle}>ShowScore non activé</h2>
        {associationName ? (
          <p style={messageStyle}>
            ShowScore n'est pas activé pour <strong>{associationName}</strong>.
          </p>
        ) : null}
        <p style={messageStyle}>
          ShowScore Live Scoring est inclus à partir du plan <strong>Professional</strong>.
        </p>
        <a
          href="mailto:support@horseshowplatform.com?subject=Activer ShowScore"
          style={buttonStyle}
        >
          Contacter pour activer
        </a>
      </div>
    </div>
  );
}

const containerStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 40,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  maxWidth: 480,
  margin: "40px auto",
  textAlign: "center",
};

const lockIconStyle = {
  width: 48,
  height: 48,
  margin: "0 auto 16px",
  position: "relative",
};

const lockShackleStyle = {
  position: "absolute",
  left: 13,
  top: 4,
  width: 22,
  height: 22,
  border: "4px solid #111827",
  borderBottom: "none",
  borderRadius: "14px 14px 0 0",
};

const lockBodyStyle = {
  position: "absolute",
  left: 8,
  top: 22,
  width: 32,
  height: 22,
  borderRadius: 6,
  background: "#111827",
};

const titleStyle = {
  fontSize: 22,
  fontWeight: 700,
  color: "#111827",
  margin: "0 0 12px",
};

const messageStyle = {
  color: "#64748b",
  lineHeight: 1.6,
  margin: "0 0 8px",
};

const buttonStyle = {
  display: "inline-block",
  marginTop: 20,
  padding: "12px 24px",
  borderRadius: 8,
  background: "#111827",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 600,
};

export default ShowScoreNotEnabled;
