import { runs } from "../../data/mock/runs";

export function getRunsByClassId(classId) {
  return runs.filter((run) => run.classId === classId).sort((a, b) => a.draw - b.draw);
}