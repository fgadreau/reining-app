export const PROVISIONAL_RANKING_NOTE =
  "Classement provisoire selon les scores individuels. Compléter le classement avec le travail en piste, en dehors de l’app.";

export function buildProvisionalRanking(runs = []) {
  const rankedRuns = (Array.isArray(runs) ? runs : [])
    .filter((run) => String(run?.scoreTotal ?? "").trim())
    .map((run) => {
      const scoreText = String(run.scoreTotal ?? "").trim();
      const scoreValue = Number.parseFloat(scoreText);

      return {
        id: run.id,
        draw: run.draw ?? run.order ?? null,
        backNumber: run.backNumber || "",
        rider: run.rider || "",
        horse: run.horse || "",
        owner: run.owner || "",
        scoreTotal: scoreText,
        scoreValue: Number.isFinite(scoreValue) ? scoreValue : null,
      };
    })
    .sort((a, b) => {
      if (a.scoreValue == null && b.scoreValue != null) return 1;
      if (a.scoreValue != null && b.scoreValue == null) return -1;
      if (a.scoreValue != null && b.scoreValue != null) {
        return b.scoreValue - a.scoreValue;
      }
      return (a.draw || 0) - (b.draw || 0);
    });

  return rankedRuns.map((run, index) => ({
    ...run,
    rank: index + 1,
  }));
}
