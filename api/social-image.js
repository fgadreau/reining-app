const {
  DEFAULT_IMAGE_PATH,
  fetchAssociation,
  getAbsoluteUrl,
  getQueryValue,
  parseDataImage,
} = require("./social-utils");

module.exports = async function handler(req, res) {
  const associationId = getQueryValue(req, "associationId");

  if (!associationId) {
    redirectToDefaultImage(req, res);
    return;
  }

  try {
    const association = await fetchAssociation(associationId);
    const logoUrl = String(association?.logoDataUrl || "").trim();

    if (/^https?:\/\//i.test(logoUrl)) {
      res.writeHead(302, {
        location: logoUrl,
        "cache-control": "public, max-age=3600, s-maxage=3600",
      });
      res.end();
      return;
    }

    const image = parseDataImage(logoUrl);
    if (image?.buffer?.length) {
      res.statusCode = 200;
      res.setHeader("content-type", image.contentType);
      res.setHeader("cache-control", "public, max-age=3600, s-maxage=3600");
      res.setHeader("content-length", String(image.buffer.length));
      res.end(image.buffer);
      return;
    }
  } catch (error) {
    console.error("Social image fetch failed:", error);
  }

  redirectToDefaultImage(req, res);
};

function redirectToDefaultImage(req, res) {
  res.writeHead(302, {
    location: getAbsoluteUrl(req, DEFAULT_IMAGE_PATH),
    "cache-control": "public, max-age=300, s-maxage=300",
  });
  res.end();
}
