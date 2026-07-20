export const SPECIAL_PENALTY_REASON_TOKENS = ["No score", "Score 0"];
export const SPECIAL_PENALTY_REASON_MANUAL_ID = "manual_comment";
export const SPECIAL_PENALTY_REASON_NONE_ID = "no_comment";

export const SPECIAL_PENALTY_REASONS = {
  "No score": [
    {
      id: "law_infraction",
      en: "Legal infraction related to exhibition, care, or custody of the horse",
      fr: "Infraction légale liée à l'exhibition, aux soins ou à la garde du cheval",
    },
    {
      id: "animal_abuse",
      en: "Animal abuse or evidence of abuse",
      fr: "Abus animal ou preuve d'abus",
    },
    {
      id: "substance_disguising_abuse",
      en: "Paint or substance used to disguise abuse",
      fr: "Peinture ou substance utilisée pour masquer un abus",
    },
    {
      id: "illegal_equipment",
      en: "Illegal equipment",
      fr: "Équipement illégal",
    },
    {
      id: "illegal_bit_bosal_curb",
      en: "Illegal bit, bosal, or curb chain",
      fr: "Mors, bosal ou chaîne de gourmette illégal",
    },
    {
      id: "prohibited_tack",
      en: "Tack collar, tie down, or nose band",
      fr: "Tack collar, tie-down ou nose band interdit",
    },
    {
      id: "whip_or_bat",
      en: "Whip or bat",
      fr: "Fouet ou bat",
    },
    {
      id: "tail_circulation",
      en: "Attachment altering tail circulation",
      fr: "Attache modifiant la circulation de la queue",
    },
    {
      id: "belly_wrap",
      en: "Belly band, belly wrap, or material around the belly",
      fr: "Belly band, belly wrap ou matériel autour du ventre",
    },
    {
      id: "inspection_refusal",
      en: "Failure to dismount or present horse/equipment for inspection",
      fr: "Refus de descendre ou de présenter le cheval/l'équipement à l'inspection",
    },
    {
      id: "unsafe_unfair_inhumane_equipment",
      en: "Unsafe, inhumane, or unfair-advantage equipment",
      fr: "Équipement dangereux, inhumain ou donnant un avantage injuste",
    },
    {
      id: "misconduct",
      en: "Disrespect or misconduct by the exhibitor",
      fr: "Manque de respect ou inconduite de l'exhibitor",
    },
    {
      id: "unsafe_or_improper_exhibition",
      en: "Unsafe condition or improper exhibition",
      fr: "Condition dangereuse ou exhibition impropre",
    },
    {
      id: "closed_reins",
      en: "Closed reins not allowed for this class",
      fr: "Rênes fermées non permises pour cette classe",
    },
    {
      id: "electronic_communication",
      en: "Bluetooth headset or electronic communication device",
      fr: "Bluetooth ou appareil de communication électronique",
    },
    {
      id: "western_attire",
      en: "Inappropriate western attire",
      fr: "Tenue western non conforme",
    },
  ],
  "Score 0": [
    {
      id: "too_many_fingers",
      en: "More than index or first finger between reins",
      fr: "Plus que l'index ou le premier doigt entre les rênes",
    },
    {
      id: "two_hands_or_changed_hands",
      en: "Use of two hands or changing hands",
      fr: "Utilisation de deux mains ou changement de main",
    },
    {
      id: "romal_misuse",
      en: "Use of romal other than allowed",
      fr: "Utilisation du romal non conforme",
    },
    {
      id: "pattern_not_completed",
      en: "Failure to complete pattern as written",
      fr: "Pattern non complété tel qu'écrit",
    },
    {
      id: "maneuvers_out_of_order",
      en: "Maneuvers out of order or more than one quarter circle out of order",
      fr: "Manoeuvres hors ordre ou plus d'un quart de cercle hors ordre",
    },
    {
      id: "extra_maneuver",
      en: "Inclusion of a maneuver not specified",
      fr: "Ajout d'une manoeuvre non prévue",
    },
    {
      id: "equipment_failure",
      en: "Equipment failure delaying completion of the pattern",
      fr: "Bris d'équipement retardant la fin du pattern",
    },
    {
      id: "balk_or_refusal",
      en: "Balk or refusal of command delaying performance",
      fr: "Balk ou refus de commande retardant la performance",
    },
    {
      id: "runaway_or_failing_to_guide",
      en: "Running away or failing to guide",
      fr: "Cheval qui s'emporte ou n'est plus guidable",
    },
    {
      id: "not_in_lope",
      en: "Not in a lope for one half circle or one half the length of the arena",
      fr: "Pas au lope pour un demi-cercle ou une demi-longueur d'aréna",
    },
    {
      id: "overspin",
      en: "Over-spin of more than one quarter turn",
      fr: "Over-spin de plus d'un quart de tour",
    },
    {
      id: "fall",
      en: "Fall to the ground by horse or rider",
      fr: "Chute au sol du cheval ou du cavalier",
    },
    {
      id: "dropped_rein",
      en: "Dropped rein contacting the ground while the horse is in motion",
      fr: "Rêne échappée touchant le sol pendant que le cheval est en mouvement",
    },
    {
      id: "rollback_crosses_center",
      en: "Rollback crosses the center line in a run-around pattern",
      fr: "Rollback traversant la ligne du centre dans un pattern de run-around",
    },
  ],
};

export function isSpecialPenaltyReasonRequired(token) {
  return SPECIAL_PENALTY_REASON_TOKENS.includes(String(token || ""));
}

export function getSpecialPenaltyReasons(token) {
  return SPECIAL_PENALTY_REASONS[String(token || "")] || [];
}

export function findSpecialPenaltyReason(token, reasonId) {
  return getSpecialPenaltyReasons(token).find(
    (reason) => reason.id === reasonId
  );
}

export function isValidSpecialPenaltyReason(
  token,
  reasonId,
  manualComment = ""
) {
  if (!isSpecialPenaltyReasonRequired(token)) return false;
  if (reasonId === SPECIAL_PENALTY_REASON_NONE_ID) return true;
  if (reasonId === SPECIAL_PENALTY_REASON_MANUAL_ID) {
    return Boolean(String(manualComment || "").trim());
  }

  return Boolean(findSpecialPenaltyReason(token, reasonId));
}

export function buildSpecialPenaltyReasonNote(
  token,
  reasonId,
  manualComment = ""
) {
  const reason = findSpecialPenaltyReason(token, reasonId);
  const status = String(token || "").trim();
  const cleanManualComment = String(manualComment || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!status || reasonId === SPECIAL_PENALTY_REASON_NONE_ID) return "";

  if (
    reasonId === SPECIAL_PENALTY_REASON_MANUAL_ID &&
    cleanManualComment
  ) {
    return `${status} - Commentaire / Comment: ${cleanManualComment}`;
  }

  if (!reason) return "";

  return `${status} - Raison: ${reason.fr} / Reason: ${reason.en}`;
}

function isSpecialPenaltyReasonLine(line, token) {
  const status = String(token || "").trim();
  const text = String(line || "").trim();

  if (!status) return false;

  return (
    text.startsWith(`${status} - Raison:`) ||
    text.startsWith(`${status} - Reason:`) ||
    text.startsWith(`${status} - Commentaire`) ||
    text.startsWith(`${status} - Comment:`)
  );
}

export function normalizeSpecialPenaltyReasonNote(note) {
  return String(note || "")
    .split(/\r?\n/)
    .map((line) =>
      line.replace(
        /^(No score|Score 0) \[M\d+(?:: [^\]]*)?\]( - (?:Raison|Reason|Commentaire|Comment):)/,
        "$1$2"
      )
    )
    .join("\n")
    .trim();
}

export function removeSpecialPenaltyReasonNote(note, token) {
  return normalizeSpecialPenaltyReasonNote(note)
    .split(/\r?\n/)
    .filter((line) => !isSpecialPenaltyReasonLine(line, token))
    .join("\n")
    .trim();
}

export function upsertSpecialPenaltyReasonNote(
  note,
  token,
  reasonId,
  manualComment = ""
) {
  const nextLine = buildSpecialPenaltyReasonNote(token, reasonId, manualComment);
  const currentNote = normalizeSpecialPenaltyReasonNote(note);

  if (!nextLine) return currentNote;

  return [currentNote, nextLine].filter(Boolean).join("\n");
}
