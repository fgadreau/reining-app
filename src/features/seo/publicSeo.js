export function buildPublicDirectorySeo(t) {
  return {
    title: t("public.seo.directoryTitle"),
    description: t("public.seo.directoryDescription"),
  };
}

export function buildAssociationPublicSeo({ association, t }) {
  const associationName =
    association?.name || association?.shortName || t("common.association");

  return {
    title: t("public.seo.associationTitle", { associationName }),
    description: t("public.seo.associationDescription", { associationName }),
  };
}

export function buildShowPublicSeo({ association, show, t }) {
  const associationName =
    association?.name || association?.shortName || t("common.association");
  const showName = show?.name || t("common.show");

  return {
    title: t("public.seo.showTitle", { showName, associationName }),
    description: t("public.seo.showDescription", {
      showName,
      associationName,
    }),
  };
}

export function buildChampionshipPublicSeo({ association, season, t }) {
  const associationName =
    association?.shortName || association?.name || t("common.association");
  const baseTitle = season?.title || t("championship.public.title");
  const year = String(season?.year || "").trim();
  const championshipTitle =
    year && !baseTitle.includes(year) ? `${baseTitle} ${year}` : baseTitle;

  return {
    title: `${championshipTitle} | ${associationName} | ShowScore`,
    description: t("championship.public.description", {
      associationName,
    }),
  };
}
