import { updateClass } from "./classStorage";
import { saveClassRecord } from "./classRecordStorage";
import {
  getClassSetupRepository,
  saveClassSetupRepository,
} from "./classSetupRepository";

export async function finalizeClassWithJudge({
  classId,
  judgeName,
  judgeSignature,
  finalizedAt = new Date().toISOString(),
}) {
  const normalizedJudgeName = String(judgeName || "").trim();
  const currentSetup = await getClassSetupRepository(classId);

  const nextSetup = {
    ...currentSetup,
    finalized: true,
    finalizedAt,
    judgeName: normalizedJudgeName,
    judgeSignature,
    judgeSignedAt: finalizedAt,
  };

  await saveClassSetupRepository(classId, nextSetup);
  saveClassRecord(classId, {
    official: {
      judgeName: normalizedJudgeName,
      judgeSignature,
      finalized: true,
      finalizedAt,
      judgeSignedAt: finalizedAt,
      secretariatValidatedAt: null,
    },
  });

  updateClass(classId, {
    judgeName: normalizedJudgeName,
    finalized: true,
    finalizedAt,
    judgeSignedAt: finalizedAt,
  });

  return {
    finalizedAt,
    judgeName: normalizedJudgeName,
    setup: nextSetup,
  };
}

export async function saveFinalPdfFileName(classId, fileName) {
  const currentSetup = await getClassSetupRepository(classId);
  const nextSetup = {
    ...currentSetup,
    finalPdf: null,
    finalPdfFileName: fileName,
  };

  await saveClassSetupRepository(classId, nextSetup);
  saveClassRecord(classId, {
    official: {
      finalPdfFileName: fileName,
    },
  });

  return nextSetup;
}
