import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPublicAssociationsRepository } from "../../features/publication/publicViewRepository";
import { appStyles as styles } from "../../styles/appStyles";

function PublicAssociationsPage() {
  const [associations, setAssociations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadAssociations() {
      setIsLoading(true);
      const nextAssociations = await getPublicAssociationsRepository();
      if (!isMounted) return;
      setAssociations(nextAssociations);
      setIsLoading(false);
    }

    loadAssociations();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={styles.app}>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Vitrine publique</div>
          <h1 style={titleStyle}>Associations</h1>
          <div style={subtitleStyle}>
            Shows en cours et feuilles de pointage publiées
          </div>
        </div>
        <Link to="/login" style={secondaryLinkStyle}>
          Connexion
        </Link>
      </section>

      {isLoading ? (
        <div style={emptyStateStyle}>Chargement des associations…</div>
      ) : associations.length === 0 ? (
        <div style={emptyStateStyle}>
          Aucun contenu public disponible pour l’instant. Lance la migration
          publique dans Supabase, puis autorise le live public dans le setup
          d’une classe ou publie des feuilles de pointage.
        </div>
      ) : (
        <div style={gridStyle}>
          {associations.map((association) => (
            <article key={association.id} style={cardStyle}>
              <div>
                <h2 style={cardTitleStyle}>{association.name}</h2>
                <div style={mutedTextStyle}>
                  {association.shortName || "Association"}
                  {association.timezone ? ` · ${association.timezone}` : ""}
                </div>
              </div>
              <Link
                to={`/public/associations/${association.id}`}
                style={primaryLinkStyle}
              >
                Voir les shows
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const heroStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 18,
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
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

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 8,
  padding: 16,
  border: "1px solid #e2e8f0",
  display: "grid",
  gap: 14,
  alignContent: "space-between",
};

const cardTitleStyle = {
  margin: 0,
  fontSize: 20,
};

const mutedTextStyle = {
  color: "#64748b",
  marginTop: 6,
};

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

export default PublicAssociationsPage;
