const SPONSOR_LOGO_MAX_WIDTH = 900;
const SPONSOR_LOGO_MAX_HEIGHT = 500;
const SPONSOR_LOGO_TARGET_BYTES = 250 * 1024;
const SPONSOR_LOGO_QUALITY_STEPS = [0.85, 0.8, 0.75, 0.7, 0.65];

export function normalizeSponsorLogos(value) {
  if (!Array.isArray(value)) {
    return flattenSponsorGroups(value);
  }

  const isGroupList = value.some((item) => Array.isArray(item?.logos));
  if (isGroupList) return flattenSponsorGroups(value);

  return normalizeSponsorLogoList(value);
}

export function normalizeSponsorGroups(value) {
  const sourceGroups = Array.isArray(value?.groups)
    ? value.groups
    : Array.isArray(value) && value.some((item) => Array.isArray(item?.logos))
      ? value
      : Array.isArray(value) && value.length
        ? [
            {
              id: "legacy-sponsors",
              name: "",
              logos: value,
            },
          ]
        : [];

  return sourceGroups.map((group, index) => ({
    id: String(group?.id || `sponsor-level-${index + 1}`),
    name: String(group?.name || "").trim(),
    sortOrder: index + 1,
    logos: normalizeSponsorLogoList(group?.logos),
  }));
}

export function getAssociationSponsorGroups(association) {
  const sponsorGroups = normalizeSponsorGroups(association?.sponsorGroups);

  if (sponsorGroups.length) {
    return sponsorGroups;
  }

  return normalizeSponsorGroups(association?.sponsorLogos);
}

export function serializeSponsorGroups(value) {
  return {
    version: 2,
    groups: normalizeSponsorGroups(value),
  };
}

export function flattenSponsorGroups(value) {
  return normalizeSponsorGroups(value).flatMap((group) =>
    group.logos.map((logo) => ({
      ...logo,
      sponsorLevelId: group.id,
      sponsorLevelName: group.name,
      sponsorLevelOrder: group.sortOrder,
    }))
  );
}

export function buildSponsorLevelSlides(value, logosPerSlide) {
  const pageSize = Math.max(1, Number.parseInt(logosPerSlide, 10) || 1);

  return normalizeSponsorGroups(value).flatMap((group) => {
    const slides = [];
    for (let index = 0; index < group.logos.length; index += pageSize) {
      slides.push({
        id: `${group.id}-slide-${Math.floor(index / pageSize) + 1}`,
        groupId: group.id,
        groupName: group.name,
        sponsors: group.logos.slice(index, index + pageSize),
      });
    }
    return slides;
  });
}

function normalizeSponsorLogoList(value) {
  return (Array.isArray(value) ? value : [])
    .map((logo, index) => {
      const normalized = {
        id: String(logo?.id || `sponsor-${index + 1}`),
        name: String(logo?.name || "").trim(),
        logoDataUrl: String(logo?.logoDataUrl || logo?.logo_data_url || "").trim(),
      };
      const width = normalizePositiveInteger(logo?.width);
      const height = normalizePositiveInteger(logo?.height);
      const originalBytes = normalizePositiveInteger(
        logo?.originalBytes || logo?.original_bytes
      );
      const optimizedBytes = normalizePositiveInteger(
        logo?.optimizedBytes || logo?.optimized_bytes
      );
      const mimeType = String(logo?.mimeType || logo?.mime_type || "").trim();

      if (width) normalized.width = width;
      if (height) normalized.height = height;
      if (originalBytes) normalized.originalBytes = originalBytes;
      if (optimizedBytes) normalized.optimizedBytes = optimizedBytes;
      if (mimeType) normalized.mimeType = mimeType;

      return normalized;
    })
    .filter((logo) => logo.logoDataUrl);
}

export async function optimizeSponsorLogoFile(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const originalBytes = normalizePositiveInteger(file?.size) || 0;
  const originalType = String(file?.type || "").toLowerCase();
  const fileName = String(file?.name || "").toLowerCase();

  if (
    !canOptimizeRasterImage() ||
    originalType === "image/svg+xml" ||
    fileName.endsWith(".svg")
  ) {
    return {
      dataUrl: originalDataUrl,
      originalBytes,
      optimizedBytes: estimateDataUrlBytes(originalDataUrl),
      mimeType: originalType,
    };
  }

  try {
    const image = await loadImage(originalDataUrl);
    const sourceWidth = image.naturalWidth || image.width || 0;
    const sourceHeight = image.naturalHeight || image.height || 0;
    const { width, height } = getContainedDimensions({
      width: sourceWidth,
      height: sourceHeight,
      maxWidth: SPONSOR_LOGO_MAX_WIDTH,
      maxHeight: SPONSOR_LOGO_MAX_HEIGHT,
    });

    if (!width || !height) {
      throw new Error("Invalid image dimensions");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is unavailable");
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const candidates = SPONSOR_LOGO_QUALITY_STEPS.map((quality) => {
      const dataUrl = canvas.toDataURL("image/webp", quality);
      return {
        dataUrl,
        optimizedBytes: estimateDataUrlBytes(dataUrl),
        mimeType: parseDataUrlMimeType(dataUrl),
      };
    });
    const bestCandidate =
      candidates.find(
        (candidate) => candidate.optimizedBytes <= SPONSOR_LOGO_TARGET_BYTES
      ) || candidates[candidates.length - 1];

    return {
      dataUrl: bestCandidate.dataUrl,
      width,
      height,
      originalBytes,
      optimizedBytes: bestCandidate.optimizedBytes,
      mimeType: bestCandidate.mimeType,
    };
  } catch (error) {
    console.error("Erreur optimisation logo commanditaire:", error);

    return {
      dataUrl: originalDataUrl,
      originalBytes,
      optimizedBytes: estimateDataUrlBytes(originalDataUrl),
      mimeType: originalType,
    };
  }
}

export function formatSponsorLogoDetails(sponsor) {
  const size = formatFileSize(sponsor?.optimizedBytes);
  const dimensions =
    sponsor?.width && sponsor?.height ? `${sponsor.width}x${sponsor.height}` : "";

  return [size, dimensions].filter(Boolean).join(" - ");
}

function normalizePositiveInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return null;

  return Math.round(number);
}

function canOptimizeRasterImage() {
  return (
    typeof document !== "undefined" &&
    typeof Image !== "undefined" &&
    typeof FileReader !== "undefined"
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = dataUrl;
  });
}

function getContainedDimensions({ width, height, maxWidth, maxHeight }) {
  if (!width || !height) {
    return { width: 0, height: 0 };
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function estimateDataUrlBytes(dataUrl) {
  const value = String(dataUrl || "");
  const base64 = value.includes(",") ? value.split(",").pop() || "" : value;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;

  if (!base64) return 0;

  return Math.max(0, Math.round((base64.length * 3) / 4) - padding);
}

function parseDataUrlMimeType(dataUrl) {
  const match = /^data:([^;]+);/i.exec(String(dataUrl || ""));

  return match?.[1] || "";
}

function formatFileSize(bytes) {
  const value = normalizePositiveInteger(bytes);

  if (!value) return "";
  if (value < 1024) return `${value} B`;

  const kilobytes = value / 1024;

  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
