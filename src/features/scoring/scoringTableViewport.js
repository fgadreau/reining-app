const MIN_LANDSCAPE_TABLE_WIDTH = 740;
const MAX_LANDSCAPE_TABLE_WIDTH = 1240;

export function shouldFitScoringTableToViewport({ width, height } = {}) {
  const viewportWidth = Number(width);
  const viewportHeight = Number(height);

  return Boolean(
    Number.isFinite(viewportWidth) &&
      Number.isFinite(viewportHeight) &&
      viewportWidth >= MIN_LANDSCAPE_TABLE_WIDTH &&
      viewportWidth <= MAX_LANDSCAPE_TABLE_WIDTH &&
      viewportWidth > viewportHeight
  );
}
