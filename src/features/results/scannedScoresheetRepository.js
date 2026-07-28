import jsPDF from "jspdf";
import { getSupabaseClient } from "../cloud/supabaseClient";

const STORAGE_KEY = "showscore_scanned_scoresheets_v1";

export const SCANNED_SCORESHEET_BUCKET = "class-scoresheets";
export const SCANNED_SCORESHEET_DOCUMENT_TYPE = "scoresheet_scan";
export const SCANNED_SCORESHEET_MAX_BYTES = 20 * 1024 * 1024;
export const SCANNED_SCORESHEET_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

const SCANNED_SCORESHEET_IMAGE_MAX_DIMENSION = 2400;

function loadLocalDocuments() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.error("Erreur lecture scoresheets scannées:", error);
    return {};
  }
}

function saveLocalDocuments(documents) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents || {}));
  } catch (error) {
    console.error("Erreur sauvegarde scoresheets scannées:", error);
  }
}

function saveLocalDocument(document) {
  if (!document?.classId) return;

  saveLocalDocuments({
    ...loadLocalDocuments(),
    [document.classId]: document,
  });
}

function deleteLocalDocument(classId) {
  const documents = loadLocalDocuments();
  delete documents[classId];
  saveLocalDocuments(documents);
}

function toDocument(row) {
  return {
    classId: row?.class_id || row?.classId || "",
    associationId: row?.organization_id || row?.associationId || "",
    showId: row?.show_id || row?.showId || "",
    documentType:
      row?.document_type ||
      row?.documentType ||
      SCANNED_SCORESHEET_DOCUMENT_TYPE,
    storagePath: row?.storage_path || row?.storagePath || "",
    fileName: row?.file_name || row?.fileName || "",
    fileSize: Number(row?.file_size || row?.fileSize || 0),
    uploadedAt: row?.uploaded_at || row?.uploadedAt || null,
    uploadedBy: row?.uploaded_by || row?.uploadedBy || null,
    publicUrl: row?.public_url || row?.publicUrl || "",
  };
}

function toDocumentRow(document) {
  return {
    class_id: document.classId,
    organization_id: document.associationId,
    show_id: document.showId,
    document_type: SCANNED_SCORESHEET_DOCUMENT_TYPE,
    storage_path: document.storagePath,
    file_name: document.fileName,
    file_size: document.fileSize,
    uploaded_at: document.uploadedAt,
    uploaded_by: document.uploadedBy,
  };
}

export function validateScannedScoresheetFile(file) {
  if (!file) {
    throw new Error("Aucun fichier PDF sélectionné.");
  }

  const fileName = String(file.name || "").trim();
  const mimeType = String(file.type || "").toLowerCase();
  const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(fileName);

  if (!isPdf) {
    throw new Error("La scoresheet doit être un fichier PDF.");
  }

  if (Number(file.size || 0) > SCANNED_SCORESHEET_MAX_BYTES) {
    throw new Error("La scoresheet PDF doit faire 20 Mo ou moins.");
  }

  return file;
}

export function validateScannedScoresheetImageFile(file) {
  if (!file) {
    throw new Error("Aucune photo sélectionnée.");
  }

  const fileName = String(file.name || "").trim();
  const mimeType = String(file.type || "").toLowerCase();
  const isImage =
    mimeType.startsWith("image/") ||
    /\.(?:jpe?g|png|webp|heic|heif)$/i.test(fileName);

  if (!isImage) {
    throw new Error("Le scan doit être une photo.");
  }

  if (Number(file.size || 0) > SCANNED_SCORESHEET_IMAGE_MAX_BYTES) {
    throw new Error("La photo doit faire 20 Mo ou moins.");
  }

  return file;
}

export async function convertScannedScoresheetImageToPdf(
  file,
  { fileName = "scoresheet-scan.pdf" } = {}
) {
  validateScannedScoresheetImageFile(file);

  const imageDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(imageDataUrl);
  const jpeg = renderScoresheetImageAsJpeg(image);
  const isLandscape = jpeg.width > jpeg.height;
  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "pt",
    format: "letter",
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const scale = Math.min(
    (pageWidth - margin * 2) / jpeg.width,
    (pageHeight - margin * 2) / jpeg.height
  );
  const renderedWidth = jpeg.width * scale;
  const renderedHeight = jpeg.height * scale;

  pdf.addImage(
    jpeg.dataUrl,
    "JPEG",
    (pageWidth - renderedWidth) / 2,
    (pageHeight - renderedHeight) / 2,
    renderedWidth,
    renderedHeight,
    undefined,
    "MEDIUM"
  );

  const blob = pdf.output("blob");
  const normalizedFileName = normalizePdfFileName(fileName);
  const pdfFile = new File([blob], normalizedFileName, {
    type: "application/pdf",
    lastModified: Date.now(),
  });

  validateScannedScoresheetFile(pdfFile);
  return pdfFile;
}

export function formatScannedScoresheetSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "";

  const precision = size >= 10 * 1024 * 1024 ? 0 : 1;
  return `${(size / (1024 * 1024)).toFixed(precision)} Mo`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(reader.error || new Error("Impossible de lire la photo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error(
          "Impossible d’ouvrir cette photo. Essaie une photo JPEG ou PNG."
        )
      );
    image.src = dataUrl;
  });
}

function renderScoresheetImageAsJpeg(image) {
  const sourceWidth = Number(image?.naturalWidth || image?.width || 0);
  const sourceHeight = Number(image?.naturalHeight || image?.height || 0);

  if (!sourceWidth || !sourceHeight) {
    throw new Error("La photo sélectionnée est vide.");
  }

  const scale = Math.min(
    SCANNED_SCORESHEET_IMAGE_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight),
    1
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Le navigateur ne peut pas préparer cette photo.");
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.88),
    width,
    height,
  };
}

function normalizePdfFileName(value) {
  const baseName = String(value || "scoresheet-scan.pdf")
    .trim()
    .replace(/\.pdf$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${baseName || "scoresheet-scan"}.pdf`;
}

function hashFileFingerprint(file) {
  const fingerprint = [
    file?.name || "scoresheet.pdf",
    file?.size || 0,
    file?.lastModified || 0,
  ].join("-");
  let hash = 2166136261;

  for (let index = 0; index < fingerprint.length; index += 1) {
    hash ^= fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

export function buildScannedScoresheetPath({ classId, file }) {
  const safeClassId = String(classId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-");

  if (!safeClassId) {
    throw new Error("Bloc introuvable.");
  }

  return `${safeClassId}/scoresheet-${hashFileFingerprint(file)}.pdf`;
}

export function getScannedScoresheetPublicUrl(documentOrPath) {
  const document =
    documentOrPath && typeof documentOrPath === "object"
      ? documentOrPath
      : { storagePath: documentOrPath };
  const cachedUrl = String(document?.publicUrl || "").trim();
  const storagePath = String(document?.storagePath || "").trim();

  if (cachedUrl) return cachedUrl;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  if (!storagePath) return "";

  const supabase = getSupabaseClient();
  if (!supabase) return "";

  const { data } = supabase.storage
    .from(SCANNED_SCORESHEET_BUCKET)
    .getPublicUrl(storagePath);

  return data?.publicUrl || "";
}

export function getLocalScannedScoresheetsForShow(showId) {
  return Object.values(loadLocalDocuments())
    .map(toDocument)
    .filter(
      (document) =>
        document.showId === showId &&
        document.documentType === SCANNED_SCORESHEET_DOCUMENT_TYPE
    )
    .reduce((documents, document) => {
      documents[document.classId] = {
        ...document,
        publicUrl: getScannedScoresheetPublicUrl(document),
      };
      return documents;
    }, {});
}

export async function getScannedScoresheetsForShowRepository(showId) {
  const localDocuments = getLocalScannedScoresheetsForShow(showId);
  const supabase = getSupabaseClient();

  if (!supabase || !showId) return localDocuments;

  try {
    const { data, error } = await supabase
      .from("show_score_class_documents")
      .select("*")
      .eq("show_id", showId)
      .eq("document_type", SCANNED_SCORESHEET_DOCUMENT_TYPE);

    if (error) throw error;

    return (data || []).reduce((documents, row) => {
      const document = toDocument(row);
      const normalized = {
        ...document,
        publicUrl: getScannedScoresheetPublicUrl(document),
      };
      documents[document.classId] = normalized;
      saveLocalDocument(normalized);
      return documents;
    }, {});
  } catch (error) {
    console.error("Erreur chargement scoresheets scannées Supabase:", error);
    return localDocuments;
  }
}

export async function uploadScannedScoresheetRepository({
  associationId,
  showId,
  classId,
  file,
  uploadedBy = null,
}) {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase doit être connecté pour téléverser une scoresheet.");
  }

  validateScannedScoresheetFile(file);

  const previousDocuments =
    await getScannedScoresheetsForShowRepository(showId);
  const previousDocument = previousDocuments[classId] || null;
  const storagePath = buildScannedScoresheetPath({ classId, file });
  const uploadedAt = new Date().toISOString();
  let uploaderId = uploadedBy;

  if (!uploaderId) {
    const { data } = await supabase.auth.getUser();
    uploaderId = data?.user?.id || null;
  }

  const { error: uploadError } = await supabase.storage
    .from(SCANNED_SCORESHEET_BUCKET)
    .upload(storagePath, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: "application/pdf",
    });

  if (uploadError) throw uploadError;

  const document = {
    classId,
    associationId,
    showId,
    documentType: SCANNED_SCORESHEET_DOCUMENT_TYPE,
    storagePath,
    fileName: String(file.name || "scoresheet.pdf"),
    fileSize: Number(file.size || 0),
    uploadedAt,
    uploadedBy: uploaderId,
  };
  const { data, error: metadataError } = await supabase
    .from("show_score_class_documents")
    .upsert(toDocumentRow(document), {
      onConflict: "class_id,document_type",
    })
    .select("*")
    .single();

  if (metadataError) {
    await supabase.storage
      .from(SCANNED_SCORESHEET_BUCKET)
      .remove([storagePath]);
    throw metadataError;
  }

  if (
    previousDocument?.storagePath &&
    previousDocument.storagePath !== storagePath
  ) {
    const { error: removePreviousError } = await supabase.storage
      .from(SCANNED_SCORESHEET_BUCKET)
      .remove([previousDocument.storagePath]);

    if (removePreviousError) {
      console.error(
        "Erreur retrait ancienne scoresheet scannée:",
        removePreviousError
      );
    }
  }

  const savedDocument = {
    ...toDocument(data || toDocumentRow(document)),
    publicUrl: getScannedScoresheetPublicUrl(document),
  };
  saveLocalDocument(savedDocument);
  return savedDocument;
}

export async function deleteScannedScoresheetRepository(document) {
  const normalized = toDocument(document);
  const supabase = getSupabaseClient();

  if (!normalized.classId) return;
  if (!supabase) {
    throw new Error("Supabase doit être connecté pour retirer une scoresheet.");
  }

  if (normalized.storagePath) {
    const { error: storageError } = await supabase.storage
      .from(SCANNED_SCORESHEET_BUCKET)
      .remove([normalized.storagePath]);

    if (storageError) throw storageError;
  }

  const { error: metadataError } = await supabase
    .from("show_score_class_documents")
    .delete()
    .eq("class_id", normalized.classId)
    .eq("document_type", SCANNED_SCORESHEET_DOCUMENT_TYPE);

  if (metadataError) throw metadataError;
  deleteLocalDocument(normalized.classId);
}
