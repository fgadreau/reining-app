import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../../features/i18n/I18nProvider";
import { appStyles as styles } from "../../styles/appStyles";

function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div style={styles.app}>
      <h1>{t("notFound.title")}</h1>
      <Link to="/associations">{t("notFound.backAssociations")}</Link>
    </div>
  );
}

export default NotFoundPage;
