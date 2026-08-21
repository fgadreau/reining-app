import { describe, expect, test } from "vitest";
import { applyAnnouncerScoreKey } from "./AnnouncerDashboardPage";

describe("announcer score pad", () => {
  test("enters a half-point score with the dedicated key", () => {
    let value = "";
    value = applyAnnouncerScoreKey(value, "7");
    value = applyAnnouncerScoreKey(value, "0");
    value = applyAnnouncerScoreKey(value, "½");

    expect(value).toBe("70½");
  });

  test("supports decimal, backspace and clear actions", () => {
    expect(applyAnnouncerScoreKey("70", ",")).toBe("70,");
    expect(applyAnnouncerScoreKey("70,", "5")).toBe("70,5");
    expect(applyAnnouncerScoreKey("70½", "backspace")).toBe("70");
    expect(applyAnnouncerScoreKey("70½", "clear")).toBe("");
  });

  test("prevents malformed half-point input", () => {
    expect(applyAnnouncerScoreKey("", "½")).toBe("");
    expect(applyAnnouncerScoreKey("70½", "½")).toBe("70½");
    expect(applyAnnouncerScoreKey("70,5", "½")).toBe("70½");
    expect(applyAnnouncerScoreKey("70½", "5")).toBe("70½");
  });
});
