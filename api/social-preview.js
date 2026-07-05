const {
  buildAssociationPreviewMetadata,
  buildChampionshipPreviewMetadata,
  fetchAssociation,
  fetchPublicChampionshipSeason,
  getQueryValue,
  renderPreviewHtml,
} = require("./social-utils");

module.exports = async function handler(req, res) {
  const associationId = getQueryValue(req, "associationId");
  const type = getQueryValue(req, "type") || "association";

  if (!associationId) {
    res.statusCode = 400;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Missing associationId");
    return;
  }

  let association = null;
  let season = null;

  try {
    association = await fetchAssociation(associationId);
    if (type === "championship") {
      season = await fetchPublicChampionshipSeason(associationId);
    }
  } catch (error) {
    console.error("Social preview data fetch failed:", error);
  }

  const metadata =
    type === "championship"
      ? buildChampionshipPreviewMetadata({
          association,
          associationId,
          season,
          req,
        })
      : buildAssociationPreviewMetadata({
          association,
          associationId,
          req,
        });

  res.statusCode = 200;
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=300, s-maxage=300");
  res.end(renderPreviewHtml(metadata));
};
