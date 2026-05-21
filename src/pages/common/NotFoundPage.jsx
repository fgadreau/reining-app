import React from "react";
import { Link } from "react-router-dom";
import { appStyles as styles } from "../../styles/appStyles";

function NotFoundPage() {
  return (
    <div style={styles.app}>
      <h1>Page non trouvée</h1>
      <Link to="/associations">Retour aux associations</Link>
    </div>
  );
}

export default NotFoundPage;