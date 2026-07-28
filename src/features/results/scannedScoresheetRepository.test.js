import { expect, test } from "vitest";
import {
  SCANNED_SCORESHEET_IMAGE_MAX_BYTES,
  validateScannedScoresheetImageFile,
} from "./scannedScoresheetRepository";

test("accepts a phone camera image as a scoresheet scan", () => {
  const image = new File(["scoresheet"], "scoresheet.jpg", {
    type: "image/jpeg",
  });

  expect(validateScannedScoresheetImageFile(image)).toBe(image);
});

test("rejects non-image files from the camera scan action", () => {
  const pdf = new File(["scoresheet"], "scoresheet.pdf", {
    type: "application/pdf",
  });

  expect(() => validateScannedScoresheetImageFile(pdf)).toThrow(
    "Le scan doit être une photo."
  );
});

test("rejects phone images larger than the upload limit", () => {
  const image = {
    name: "scoresheet.jpg",
    type: "image/jpeg",
    size: SCANNED_SCORESHEET_IMAGE_MAX_BYTES + 1,
  };

  expect(() => validateScannedScoresheetImageFile(image)).toThrow(
    "La photo doit faire 20 Mo ou moins."
  );
});
