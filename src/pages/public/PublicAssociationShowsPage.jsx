import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getPublicAssociationRepository,
  getPublicShowsByAssociationRepository,
} from "../../features/publication/publicViewRepository";
import { appStyles as styles } from "../../styles/appStyles";

function PublicAssociationShowsPage() {
  const { associationId } = useParams();
  const [association, setAssociation] = useState(null);
  const [shows, setShows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadShows() {
      setIsLoading(true);
      const [nextAssociation, nextShows] = await Promise.all([
        getPublicAssociationRepository(associationId),
        getPublicShowsByAssociationRepository(associationId),
      ]);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setShows(nextShows);
      setIsLoading(false);
    }

    loadShows();

    return () => {
      isMounted = false;
    };
  }, [associationId]);

  return (
    <div style={styles.app}>
      <div style={{ marginBottom: 16 }}>
        <Link to="/public" style={secondaryLinkStyle}>
          ← Associations
        </Link>
      </div>

      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Résultats publics</div>
          <h1 style={titleStyle}>{association?.name || "Association"}</h1>
          <div style={subtitleStyle}>
            Shows avec live public ou résultats officiels publiés
          </div>
        </div>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>Chargement des shows…</div>
      ) : shows.length === 0 ? (
        <div style={emptyStateStyle}>
          Aucun show public disponible pour cette association. Il faut au moins
          une classe avec le live public autorisé ou des résultats officiels
          publiés.
        </div>
      ) : (
        <div style={showListStyle}>
          {shows.map((show) => (
            <article key={show.id} style={cardStyle}>
              <div>
                <h2 style={cardTitleStyle}>{show.name}</h2>
                <div style={mutedTextStyle}>
                  {show.venue || show.location || "Lieu à confirmer"}
                  {show.startDate ? ` · ${show.startDate}` : ""}
                </div>
                <div style={badgeRowStyle}>
                  {show.liveClassCount > 0 && <Badge tone="live">Live</Badge>}
                  {show.publishedClassCount > 0 && (
                    <Badge>{show.publishedClassCount} classe(s) publiée(s)</Badge>
                  )}
                </div>
              </div>
              <Link
                to={`/public/associations/${associationId}/shows/${show.id}`}
                style={primaryLinkStyle}
              >
                Voir le show
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ children, tone = "published" }) {
  return <span style={badgeStyle(tone)}>{children}</span>;
}

const heroStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
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
  fontSize: 30,
};

const subtitleStyle = {
  color: "#64748b",
};

const showListStyle = {
  display: "grid",
  gap: 12,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px solid #e2e8f0",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const cardTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const mutedTextStyle = {
  color: "#64748b",
  marginTop: 6,
};

const badgeRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const badgeStyle = (tone) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 9px",
  borderRadius: 999,
  border: `1px solid ${tone === "live" ? "#86efac" : "#bfdbfe"}`,
  background: tone === "live" ? "#ecfdf5" : "#eff6ff",
  color: tone === "live" ? "#166534" : "#1d4ed8",
  fontWeight: 800,
  fontSize: 13,
});

const primaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  textDecoration: "none",
};

const secondaryLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#111827",
  textDecoration: "none",
};

const emptyStateStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px dashed #cbd5e1",
  color: "#64748b",
};

export default PublicAssociationShowsPage;
