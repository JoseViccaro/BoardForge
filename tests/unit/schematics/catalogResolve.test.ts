import { describe, it, expect } from "vitest";
import {
  SchematicCatalogService,
  type SchematicManifest,
  type ManifestEntry,
  type CatalogResolveResult,
} from "../../../src/infrastructure/schematics/catalog/SchematicCatalogService.js";
import type { SchematicDocumentBundle } from "../../../src/infrastructure/schematics/catalog/SchematicBundleSerializer.js";
import { SchematicDocument } from "../../../src/domain/schematics/aggregates/SchematicDocument.js";
import { iPhone13SchematicFixtures } from "../../../src/infrastructure/seeds/iPhone13SchematicFixtures.js";

const revA1: ManifestEntry = {
  boardModel: "iPhone13_SCH",
  boardRevision: "REV-A1",
  file: "iphone13_REV-A1.json",
  hash: "sha256:a",
  sourceFilename: "iphone13_a1.pdf",
  importedAt: "2026-08-01T00:00:00Z",
  tokenCount: 100,
  pageCount: 50,
};

const revC1: ManifestEntry = {
  boardModel: "iPhone13_SCH",
  boardRevision: "REV-C1",
  file: "iphone13_REV-C1.json",
  hash: "sha256:c",
  sourceFilename: "iphone13_c1.pdf",
  importedAt: "2026-09-01T00:00:00Z",
  tokenCount: 120,
  pageCount: 60,
};

function makeManifest(entries: ManifestEntry[]): SchematicManifest {
  return { version: 1, entries };
}

function makeBundle(boardRevision = "REV-C1"): SchematicDocumentBundle {
  return {
    documentId: `SCH_iphone13_${boardRevision}`,
    title: `iPhone 13 ${boardRevision}`,
    pageCount: 1,
    importedAt: "2026-09-01T00:00:00Z",
    pages: [
      {
        pageNumber: 1,
        width: 1000,
        height: 800,
        tokens: [
          {
            text: "PP_VDD_MAIN",
            bounds: { minX: 120, minY: 200, maxX: 175, maxY: 215 },
            fontSize: 8,
            rotation: 0,
            tokenType: "NET_LABEL",
          },
        ],
        netLabels: [],
        symbols: [],
      },
    ],
  };
}

describe("SchematicCatalogService.resolve + hydrateBundle", () => {
  // R1.5 s1 / R2.16 s1: exact revision resolves and hydrates a document
  it("resolves an exact boardModel+boardRevision and hydrates the bundle", async () => {
    const manifest = makeManifest([revA1, revC1]);
    const service = new SchematicCatalogService({
      fetchManifest: async () => manifest,
      fetchBundle: async (entry) => makeBundle(entry.boardRevision),
    });

    const resolveResult = await service.resolve("iPhone13_SCH", "REV-C1");
    expect(resolveResult.status).toBe("FOUND");
    if (resolveResult.status !== "FOUND") return;
    expect(resolveResult.entry.boardRevision).toBe("REV-C1");

    const doc = await service.hydrateBundle(resolveResult.entry);
    expect(doc).toBeInstanceOf(SchematicDocument);
    expect(doc.documentId).toBe("SCH_iphone13_REV-C1");
    expect(doc.getPage(1)?.tokens[0].text).toBe("PP_VDD_MAIN");
  });

  // R1.5 s2 / R2.16 s2: fallback to latest revision (by timestamp) when no revision given
  it("falls back to the latest revision by timestamp when no revision is provided", async () => {
    const manifest = makeManifest([revA1, revC1]);
    const service = new SchematicCatalogService({
      fetchManifest: async () => manifest,
      fetchBundle: async () => makeBundle(),
    });

    const resolveResult = await service.resolve("iPhone13_SCH");
    expect(resolveResult.status).toBe("FOUND");
    if (resolveResult.status !== "FOUND") return;
    // REV-C1 imported later than REV-A1 -> latest
    expect(resolveResult.entry.boardRevision).toBe("REV-C1");
  });

  // R1.5 s3: missing model -> NO_BUNDLE_FOUND result, no throw
  it("returns a NO_BUNDLE_FOUND result for an unknown model and does not throw", async () => {
    const service = new SchematicCatalogService({
      fetchManifest: async () => makeManifest([revA1, revC1]),
      fetchBundle: async () => makeBundle(),
    });

    let result: CatalogResolveResult | undefined;
    await expect(
      (async () => {
        result = await service.resolve("iPhone15_SCH");
      })()
    ).resolves.toBeUndefined();

    expect(result).toBeDefined();
    expect(result!.status).toBe("NO_COMPANION");
    if (result!.status === "FOUND") return;
    expect(result!.reason).toBe("NO_BUNDLE_FOUND");
  });

  // R2.16 s3: no companion when no bundle for requested model
  it("reports NO_COMPANION / NO_BUNDLE_FOUND for a model-and-revision with no entry", async () => {
    const service = new SchematicCatalogService({
      fetchManifest: async () => makeManifest([revA1, revC1]),
      fetchBundle: async () => makeBundle(),
    });

    const result = await service.resolve("iPhone15_SCH", "REV-Z9");
    expect(result.status).toBe("NO_COMPANION");
    if (result.status === "FOUND") return;
    expect(result.reason).toBe("NO_BUNDLE_FOUND");
  });

  // R2.16 s4: golden fixture codepath unchanged in test context
  it("keeps iPhone13SchematicFixtures producing its known tokens in a test context", () => {
    const fixtures = iPhone13SchematicFixtures.createFixtures();
    const page12 = fixtures.document.getPage(12);
    expect(page12).toBeDefined();
    const texts = page12!.tokens.map((t) => t.text);
    expect(texts).toContain("PP_VDD_MAIN");
    expect(texts).toContain("A12");
    expect(fixtures.document.getPage(13)).toBeDefined();
  });
});
