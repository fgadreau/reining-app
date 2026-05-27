import React from "react";
import { getAssociationInitials } from "../features/associations/associationProfile";
import { useTranslation } from "../features/i18n/I18nProvider";

function AssociationLogo({ association, size = 64 }) {
  const { t } = useTranslation();
  const logoSource = String(association?.logoDataUrl || "").trim();
  const initials = getAssociationInitials(association);
  const associationName =
    association?.shortName || association?.name || t("common.association");
  const logoStyle = {
    ...baseLogoStyle,
    width: size,
    height: size,
    minWidth: size,
    fontSize: Math.max(13, Math.round(size / 4)),
  };

  if (logoSource) {
    return (
      <img
        src={logoSource}
        alt={t("management.associations.logoAlt", {
          associationName,
        })}
        style={{ ...logoStyle, objectFit: "contain" }}
      />
    );
  }

  return <div style={logoStyle}>{initials || "ASSO"}</div>;
}

const baseLogoStyle = {
  borderRadius: 8,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#1d4ed8",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  overflow: "hidden",
};

export default AssociationLogo;
