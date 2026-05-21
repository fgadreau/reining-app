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

export function buildAssociationInvitationMailto({
  invitation,
  origin,
  associationName,
}) {
  const invitationUrl = buildAssociationInvitationUrl(origin, invitation);
  const subject = "Invitation Reining Score";
  const body = [
    `Tu as ete invite a rejoindre ${associationName || "une association"} sur Reining Score.`,
    "",
    "Cree ton compte avec ce lien, puis connecte-toi:",
    invitationUrl,
  ].join("\n");

  return `mailto:${encodeURIComponent(invitation?.email || "")}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
