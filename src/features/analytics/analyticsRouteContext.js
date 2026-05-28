export function getPageEventContext(pathname) {
  const publicShowMatch = pathname.match(
    /^\/public\/associations\/([^/]+)\/shows\/([^/]+)/
  );

  if (publicShowMatch) {
    return {
      associationId: publicShowMatch[1],
      showId: publicShowMatch[2],
      pageCategory: "public_show",
      isPublicPath: true,
    };
  }

  const publicAssociationMatch = pathname.match(
    /^\/public\/associations\/([^/]+)/
  );

  if (publicAssociationMatch) {
    return {
      associationId: publicAssociationMatch[1],
      pageCategory: "public_association",
      isPublicPath: true,
    };
  }

  const scribeClassMatch = pathname.match(
    /^\/associations\/([^/]+)\/scribe\/classes\/([^/]+)/
  );

  if (scribeClassMatch) {
    return {
      associationId: scribeClassMatch[1],
      classId: scribeClassMatch[2],
      pageCategory: "scribe_class",
      isPublicPath: false,
    };
  }

  const classSetupMatch = pathname.match(
    /^\/associations\/([^/]+)\/classes\/([^/]+)\/setup/
  );

  if (classSetupMatch) {
    return {
      associationId: classSetupMatch[1],
      classId: classSetupMatch[2],
      pageCategory: "class_setup",
      isPublicPath: false,
    };
  }

  const showMatch = pathname.match(
    /^\/associations\/([^/]+)\/shows\/([^/]+)(?:\/days\/([^/]+))?/
  );

  if (showMatch) {
    return {
      associationId: showMatch[1],
      showId: showMatch[2],
      dayId: showMatch[3] || "",
      pageCategory: "show_management",
      isPublicPath: false,
    };
  }

  const associationMatch = pathname.match(/^\/associations\/([^/]+)/);

  if (associationMatch) {
    return {
      associationId: associationMatch[1],
      pageCategory: "association_management",
      isPublicPath: false,
    };
  }

  return {
    pageCategory: pathname.startsWith("/public") ? "public_directory" : "app",
    isPublicPath: pathname.startsWith("/public"),
  };
}
