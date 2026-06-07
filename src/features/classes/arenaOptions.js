export function normalizeArenaName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function buildArenaOptions(classes, currentArena = "") {
  const arenasByKey = new Map();

  [...(Array.isArray(classes) ? classes : []), { arena: currentArena }].forEach(
    (classItem) => {
      const arena = normalizeArenaName(classItem?.arena);
      if (!arena) return;
      arenasByKey.set(arena.toLowerCase(), arena);
    }
  );

  return Array.from(arenasByKey.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}
