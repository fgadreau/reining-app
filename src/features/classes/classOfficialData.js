import { getClassSetup } from "./classSetupStorage";
import { getClassRecord } from "./classRecordStorage";
import { getDayById } from "../days/daySelectors";
import { getShowById } from "../shows/showSelectors";
import { getPatternDisplayName } from "../patterns/patternDefinitions";

export function getClassOfficialData(classId, classItem, officialResult = null) {
  const setup = getClassSetup(classId);
  const record = getClassRecord(classId);

  const show = getShowById(classItem?.showId);
  const day = getDayById(classItem?.dayId);

  const judgeName =
    officialResult?.judgeName ||
    record?.official?.judgeName ||
    setup?.judgeName ||
    classItem?.judgeName ||
    "";

  const judgeSignature =
    officialResult?.judgeSignature ||
    record?.official?.judgeSignature ||
    setup?.judgeSignature ||
    null;

  const finalizedAt =
    officialResult?.finalizedAt ||
    record?.official?.finalizedAt ||
    record?.official?.judgeSignedAt ||
    setup?.finalizedAt ||
    setup?.judgeSignedAt ||
    classItem?.finalizedAt ||
    classItem?.judgeSignedAt ||
    null;

  const judgeSignedAt =
    officialResult?.judgeSignedAt ||
    record?.official?.judgeSignedAt ||
    setup?.judgeSignedAt ||
    classItem?.judgeSignedAt ||
    null;

  const isFinalized = Boolean(
    officialResult?.finalized ||
      record?.official?.finalized ||
      record?.official?.judgeSignedAt ||
      setup?.finalized ||
      setup?.judgeSignedAt ||
      classItem?.finalized ||
      classItem?.judgeSignedAt
  );

  const finalPdfFileName =
    officialResult?.finalPdfFileName ||
    record?.official?.finalPdfFileName ||
    setup?.finalPdfFileName ||
    null;

  const secretariatValidatedAt =
    officialResult?.secretariatValidatedAt ||
    record?.official?.secretariatValidatedAt ||
    null;

  const officialRuns =
    officialResult?.officialRuns ||
    record?.official?.officialRuns ||
    [];

  const eventName =
    show?.name ||
    classItem?.showName ||
    classItem?.show ||
    "";

  const eventDate =
    day?.date ||
    classItem?.date ||
    "";

  const pattern =
    setup?.pattern ||
    classItem?.pattern ||
    "";

  return {
    setup,
    record,
    show,
    day,
    judgeName,
    judgeSignature,
    finalizedAt,
    judgeSignedAt,
    isFinalized,
    secretariatValidatedAt,
    isSecretariatValidated: Boolean(secretariatValidatedAt),
    finalPdfFileName,
    officialRuns,
    eventName,
    eventDate,
    pattern: getPatternDisplayName(pattern) || pattern,
  };
}

export default getClassOfficialData;
