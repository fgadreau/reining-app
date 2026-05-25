export function buildAssociationInvitationUrl(origin, invitation) {
  const baseUrl = String(origin || "").replace(/\/$/, "");
  const params = new URLSearchParams();

  if (invitation?.token) {
    params.set("invite", invitation.token);
  }

  if (invitation?.email) {
    params.set("email", invitation.email);
  }

  return `${baseUrl}/login?${params.toString()}`;
}

export function buildAssociationInvitationEmail({
  invitation,
  origin,
  associationName,
}) {
  const invitationUrl = buildAssociationInvitationUrl(origin, invitation);
  const subject = "Invitation ShowScore";
  const body = [
    `Tu as été invité à rejoindre ${associationName || "une association"} sur ShowScore.`,
    "",
    "Crée ton compte avec ce lien, puis connecte-toi:",
    invitationUrl,
  ].join("\n");

  return {
    to: invitation?.email || "",
    subject,
    body,
    invitationUrl,
  };
}

export function buildAssociationInvitationMailto({
  invitation,
  origin,
  associationName,
}) {
  const email = buildAssociationInvitationEmail({
    invitation,
    origin,
    associationName,
  });

  return `mailto:${encodeURIComponent(invitation?.email || "")}?subject=${encodeURIComponent(
    email.subject
  )}&body=${encodeURIComponent(email.body)}`;
}
