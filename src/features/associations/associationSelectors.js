export function getAssociationById(associations, associationId) {
  return associations.find((association) => association.id === associationId);
}

export function getAssociationOptions(associations) {
  return associations.map((association) => ({
    value: association.id,
    label: association.shortName
      ? `${association.shortName} — ${association.name}`
      : association.name,
  }));
}