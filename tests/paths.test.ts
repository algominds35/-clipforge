import { describe, expect, it } from "vitest";
import { extensionOf, resolveInside, sanitizeFilename } from "@/lib/storage/paths";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

describe("storage paths", () => {
  it("rejects path traversal", () => {
    const root = mkdtempSync(path.join(tmpdir(), "clipforge-paths-"));
    expect(() => resolveInside(root, "../secret.mp4")).toThrow(/Invalid storage key/);
    expect(() => resolveInside(root, "uploads/../../secret.mp4")).toThrow(/Invalid storage key/);
    const safe = resolveInside(root, "uploads/user/video.mp4");
    expect(safe.startsWith(root)).toBe(true);
  });

  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../weird name!!.mp4")).toBe("weird name__.mp4");
    expect(extensionOf("clip.MP4")).toBe("mp4");
  });
});
