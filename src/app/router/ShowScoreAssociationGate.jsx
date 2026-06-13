import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getAssociationRepository } from "../../features/associations/associationRepository";
import ShowScoreNotEnabled from "../../pages/common/ShowScoreNotEnabled";
import { appStyles as styles } from "../../styles/appStyles";

function ShowScoreAssociationGate({ children }) {
  const { associationId } = useParams();
  const [association, setAssociation] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(associationId));

  useEffect(() => {
    let isMounted = true;

    async function loadAssociation() {
      if (!associationId) {
        setAssociation(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const nextAssociation = await getAssociationRepository(associationId);

      if (!isMounted) return;
      setAssociation(nextAssociation);
      setIsLoading(false);
    }

    loadAssociation();

    return () => {
      isMounted = false;
    };
  }, [associationId]);

  if (isLoading) {
    return (
      <div style={styles.app}>
        <div style={loadingStyle}>Chargement...</div>
      </div>
    );
  }

  if (association?.isShowScoreEnabled === false) {
    return <ShowScoreNotEnabled associationName={association.name} />;
  }

  return children;
}

const loadingStyle = {
  padding: 24,
  color: "#64748b",
};

export default ShowScoreAssociationGate;
