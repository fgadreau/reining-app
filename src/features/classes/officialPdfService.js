import { getPatternHeaders } from "../patterns/patternDefinitions";
import {
  buildMultiJudgeOfficialRuns,
  getJudgeSheetSummary,
  getJudgeSignatureEntries,
  getLatestTimestamp,
} from "../scoring/multiJudgeOfficialData";
import {
  buildJudgeScorePdfFileName,
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
  const judgeSummary = getJudgeSheetSummary(classData);
  const isMultiJudge = judgeSummary.isMultiJudge;
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
  const runs = isMultiJudge
    ? officialRuns.length > 0
      ? officialRuns
      : buildMultiJudgeOfficialRuns(classData, judgeSummary.rows)
    : officialRuns.length > 0
      ? officialRuns
      : Array.isArray(classData?.scoringRuns)
        ? classData.scoringRuns
        : [];
  const judgeSignatures = isMultiJudge
    ? getJudgeSignatureEntries(classData, judgeSummary.rows)
    : null;
  const multiJudgeSignedAt = isMultiJudge
    ? getLatestTimestamp(
        judgeSignatures.map((entry) => entry.judgeSignedAt || entry.finalizedAt)
      )
    : null;

  const pdf = generateScorePdf({
    associationName: association?.name || "Association",
    associationLogoDataUrl: association?.logoDataUrl || null,
    eventName: official.eventName || "",
    eventDate: official.eventDate || "",
    classItem,
    classSetup: {
      ...official.setup,
      ...classData?.setup,
      judgeName: isMultiJudge
        ? official.judgeName || "Multi-juges"
        : official.judgeName,
      judgeSignature: isMultiJudge ? null : official.judgeSignature,
      judgeSignatures,
      finalizedAt: official.finalizedAt || multiJudgeSignedAt,
      judgeSignedAt: official.judgeSignedAt || multiJudgeSignedAt,
    },
    runs,
    headers,
    showRunJudgeName: isMultiJudge,
    titleSuffix: isMultiJudge ? "Combined / Combiné" : "",
  });

  const nextFileName =
    fileName ||
    buildScorePdfFileName({
      associationAbbreviation: association?.shortName || "ASSOC",
      showName: official.eventName || "show",
      className: isMultiJudge
        ? `${classItem?.name || "bloc"}-combined`
        : classItem?.name || "bloc",
      finalizedAt:
        official.finalizedAt || multiJudgeSignedAt || new Date().toISOString(),
    });

  return {
    pdf,
    fileName: nextFileName,
  };
}

export function buildJudgeScorePdf({
  association,
  classData,
  judge,
  judgeSession,
}) {
  const classItem = classData?.classItem;
  const official = classData?.official || {};
  const setup = classData?.setup || {};
  const patternValue = setup?.pattern || classItem?.pattern || "";
  const customPattern = setup?.customPattern || classItem?.customPattern || null;
  const headers = getPatternHeaders(patternValue, customPattern);
  const judgeName = judgeSession?.judgeName || judge?.name || "";
  const finalizedAt =
    judgeSession?.finalizedAt || judgeSession?.judgeSignedAt || new Date().toISOString();

  const pdf = generateScorePdf({
    associationName: association?.name || "Association",
    associationLogoDataUrl: association?.logoDataUrl || null,
    eventName: official.eventName || "",
    eventDate: official.eventDate || "",
    classItem,
    classSetup: {
      ...setup,
      judgeName,
      judgeSignature: judgeSession?.judgeSignature || null,
      finalizedAt,
      judgeSignedAt: judgeSession?.judgeSignedAt || finalizedAt,
    },
    runs: Array.isArray(judgeSession?.runs) ? judgeSession.runs : [],
    headers,
  });

  const fileName = buildJudgeScorePdfFileName({
    associationAbbreviation: association?.shortName || "ASSOC",
    showName: official.eventName || "show",
    className: classItem?.name || "bloc",
    judgeName,
    finalizedAt,
  });

  return {
    pdf,
    fileName,
  };
}

export function downloadJudgeScorePdf({
  association,
  classData,
  judge,
  judgeSession,
}) {
  if (!judgeSession?.finalized || !judgeSession?.judgeSignature) {
    throw new Error("La feuille de ce juge doit être signée avant le PDF.");
  }

  const { pdf, fileName } = buildJudgeScorePdf({
    association,
    classData,
    judge,
    judgeSession,
  });

  pdf.save(fileName);
  return fileName;
}

export async function downloadOfficialScorePdf({
  association,
  classData,
  regenerateFileName = false,
}) {
  if (!classData?.official?.isSecretariatValidated) {
    throw new Error(
      "Le bloc doit être validé par le secrétariat avant de générer le PDF officiel."
    );
  }

  const existingFileName = getOfficialPdfFileName(classData);
  const { pdf, fileName } = buildOfficialScorePdf({
    association,
    classData,
    fileName: regenerateFileName ? null : existingFileName,
  });
  const judgeSummary = getJudgeSheetSummary(classData);
  const officialRuns = judgeSummary.isMultiJudge
    ? buildMultiJudgeOfficialRuns(classData, judgeSummary.rows)
    : Array.isArray(classData?.scoringRuns)
      ? classData.scoringRuns
      : [];

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
    officialRuns,
  });

  return fileName;
}
