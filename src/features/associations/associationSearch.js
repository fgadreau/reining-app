function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function filterAssociationsBySearch(associations, searchQuery) {
  const query = normalizeSearchValue(searchQuery);

  if (!query) {
    return Array.isArray(associations) ? associations : [];
  }

  return (Array.isArray(associations) ? associations : []).filter(
    (association) => {
      const name = normalizeSearchValue(association?.name);
      const shortName = normalizeSearchValue(association?.shortName);

      return name.includes(query) || shortName.includes(query);
    }
  );
}
