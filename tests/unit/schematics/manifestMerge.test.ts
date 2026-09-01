import { describe, it, expect } from "vitest";
import {
  ManifestMerge,
  type SchematicManifest,
  type ManifestEntry,
} from "../../../src/infrastructure/schematics/catalog/SchematicCatalogService.js";

const existingEntry: ManifestEntry = {
  boardModel: "iPhone13",
  boardRevision: "REV-C1",
  file: "schematic_iphone13_REV-C1.json",
  hash: "sha256:abc123",
  sourceFilename: "iphone13_top.pdf",
  importedAt: "2026-09-01T12:00:00Z",
  tokenCount: 1542,
  pageCount: 120,
};

function makeManifest(entries: ManifestEntry[]): SchematicManifest {
  return { version: 1, entries };
}

describe("ManifestMerge.merge (R1.6)", () => {
  // Scenario: Re-scan with no new files -> entry unchanged (no duplicate, no overwrite)
  it("is idempotent: merging an entry whose hash already exists leaves the manifest unchanged", () => {
    const manifest = makeManifest([existingEntry]);
    const sameEntry: ManifestEntry = {
      ...existingEntry,
      // Intentionally different timestamp/content — the hash is identical, so
      // the existing entry must be preserved, not overwritten or duplicated.
      importedAt: "2026-09-02T08:00:00Z",
      tokenCount: 9999,
    };

    const merged = ManifestMerge.merge(manifest, [sameEntry]);

    // No duplicate, no overwrite — exactly the original entry remains.
    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0].importedAt).toBe("2026-09-01T12:00:00Z");
    expect(merged.entries[0].tokenCount).toBe(1542);
    expect(merged.entries[0]).toEqual(existingEntry);
  });

  // Scenario: Re-scan adds new file only -> exactly one new entry, existing preserved
  it("adds exactly one new entry for a new hash while preserving existing entries", () => {
    const manifest = makeManifest([existingEntry]);
    const newEntry: ManifestEntry = {
      boardModel: "iPhone13",
      boardRevision: "REV-D1",
      file: "schematic_iphone13_REV-D1.json",
      hash: "sha256:def456",
      sourceFilename: "iphone13_bottom.pdf",
      importedAt: "2026-09-02T09:00:00Z",
      tokenCount: 800,
      pageCount: 100,
    };

    const merged = ManifestMerge.merge(manifest, [newEntry]);

    expect(merged.entries).toHaveLength(2);
    expect(merged.entries[0]).toEqual(existingEntry); // existing preserved unchanged
    expect(merged.entries[1]).toEqual(newEntry); // exactly one new entry
  });
});
