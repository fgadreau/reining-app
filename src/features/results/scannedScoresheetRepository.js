import { getSupabaseClient } from "../cloud/supabaseClient";

const STORAGE_KEY = "showscore_scanned_scoresheets_v1";

export const SCANNED_SCORESHEET_BUCKET = "class-scoresheets";
export const SCANNED_SCORESHEET_DOCUMENT_TYPE = "scoresheet_scan";
export const SCANNED_SCORESHEET_MAX_BYTES = 20 * 1024 * 1024;

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

export function formatScannedScoresheetSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) return "";

  const precision = size >= 10 * 1024 * 1024 ? 0 : 1;
  return `${(size / (1024 * 1024)).toFixed(precision)} Mo`;
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
