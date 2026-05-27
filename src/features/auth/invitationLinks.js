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
  copy,
}) {
  const invitationUrl = buildAssociationInvitationUrl(origin, invitation);
  const resolvedAssociationName =
    associationName || copy?.associationFallback || "une association";
  const subject = copy?.subject || "Invitation ShowScore";
  const body = [
    copy?.bodyIntro ||
      `Tu as été invité à rejoindre ${resolvedAssociationName} sur ShowScore.`,
    "",
    copy?.bodyAction || "Crée ton compte avec ce lien, puis connecte-toi:",
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
  copy,
}) {
  const email = buildAssociationInvitationEmail({
    invitation,
    origin,
    associationName,
    copy,
  });

  return `mailto:${encodeURIComponent(invitation?.email || "")}?subject=${encodeURIComponent(
    email.subject
  )}&body=${encodeURIComponent(email.body)}`;
}
