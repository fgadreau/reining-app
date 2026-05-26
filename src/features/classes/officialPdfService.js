import { getPatternHeaders } from "../patterns/patternDefinitions";
import {
  buildScorePdfFileName,
  generateScorePdf,
} from "../../utils/generateScorePdf";
import { saveFinalPdfFileName } from "./classFinalizationService";
import { saveOfficialResultRepository } from "./officialResultRepository";

export function getOfficialPdfFileName(classData) {
  return (
    classData?.official?.finalPdfFileName ||
    classData?.record?.official?.finalPdfFileName ||
    classData?.setup?.finalPdfFileName ||
    null
  );
}

export function buildOfficialScorePdf({ association, classData, fileName }) {
  const classItem = classData?.classItem;
  const official = classData?.official || {};
  const patternValue =
    official.patternValue || classData?.setup?.pattern || classItem?.pattern || "";
  const customPattern =
    official.customPattern ||
    classData?.setup?.customPattern ||
    classItem?.customPattern ||
    null;
  const headers = getPatternHeaders(patternValue, customPattern);
  const officialRuns = Array.isArray(official.officialRuns)
    ? official.officialRuns
    : [];

  const pdf = generateScorePdf({
    associationName: association?.name || "Association",
    associationLogoDataUrl: association?.logoDataUrl || null,
    eventName: official.eventName || "",
    eventDate: official.eventDate || "",
    classItem,
    classSetup: {
      ...official.setup,
      judgeName: official.judgeName,
      judgeSignature: official.judgeSignature,
      finalizedAt: official.finalizedAt,
      judgeSignedAt: official.judgeSignedAt,
    },
    runs:
      officialRuns.length > 0
        ? officialRuns
        : Array.isArray(classData?.scoringRuns)
          ? classData.scoringRuns
          : [],
    headers,
  });

  const nextFileName =
    fileName ||
    buildScorePdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: official.eventName || "show",
      className: classItem?.name || "classe",
      finalizedAt: official.finalizedAt || new Date().toISOString(),
    });

  return {
    pdf,
    fileName: nextFileName,
  };
}

export async function downloadOfficialScorePdf({
  association,
  classData,
  regenerateFileName = false,
}) {
  if (!classData?.official?.isSecretariatValidated) {
    throw new Error(
      "La classe doit être validée par le secrétariat avant de générer le PDF officiel."
    );
  }

  const existingFileName = getOfficialPdfFileName(classData);
  const { pdf, fileName } = buildOfficialScorePdf({
    association,
    classData,
    fileName: regenerateFileName ? null : existingFileName,
  });

  pdf.save(fileName);
  await saveFinalPdfFileName(classData.classItem?.id, fileName);
  await saveOfficialResultRepository(classData.classItem?.id, {
    ...classData.official,
    finalized: true,
    finalPdfFileName: fileName,
    customPattern:
      classData?.setup?.customPattern ||
      classData?.classItem?.customPattern ||
      classData?.official?.customPattern ||
      null,
    officialRuns: Array.isArray(classData?.scoringRuns)
      ? classData.scoringRuns
      : [],
  });

  return fileName;
}
