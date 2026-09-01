import * as crypto from "node:crypto";
import type { SchematicDocument } from "../../../domain/schematics/aggregates/SchematicDocument.js";
import type { SchematicDocumentBundle } from "./SchematicBundleSerializer.js";
import { HydrateBundle } from "./HydrateBundle.js";

/** A single manifest entry mapping a series + revision to a bundle file. */
export interface ManifestEntry {
  boardModel: string;
  boardRevision: string;
  file: string;
  hash: string;
  sourceFilename?: string;
  importedAt: string;
  parserConfidence?: string;
  tokenCount: number;
  pageCount: number;
}

/** Root shape of the `manifest.json` version 1 schema (see design.md). */
export interface SchematicManifest {
  version: number;
  entries: ManifestEntry[];
}

/** Result of a catalog resolve: either a concrete entry or NO_COMPANION/NO_BUNDLE_FOUND. */
export type CatalogResolveResult =
  | { status: "FOUND"; entry: ManifestEntry }
  | { status: "NO_COMPANION"; reason: "NO_BUNDLE_FOUND" };

/**
 * Idempotent manifest updater (R1.6). Merge is keyed on the per-bundle SHA-256
 * hash: re-merging an unchanged bundle leaves its existing entry byte-for-byte
 * intact (no duplicate, no overwrite), while a genuinely new hash is appended.
 */
export class ManifestMerge {
  /** Returns the merged manifest without mutating the input. */
  public static merge(existing: SchematicManifest, newEntries: ManifestEntry[]): SchematicManifest {
    const byHash = new Map<string, ManifestEntry>();
    for (const e of existing.entries) {
      byHash.set(e.hash, e);
    }
    for (const e of newEntries) {
      // Idempotence: an existing hash is preserved, never overwritten.
      if (!byHash.has(e.hash)) {
        byHash.set(e.hash, e);
      }
    }
    return { version: existing.version, entries: [...byHash.values()] };
  }

  /** Computes a `sha256:<hex>` content hash for a raw byte buffer. */
  public static computeSha256Hash(bytes: Uint8Array): string {
    return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
  }
}

export interface SchematicCatalogServiceDeps {
  fetchManifest: () => Promise<SchematicManifest>;
  fetchBundle: (entry: ManifestEntry) => Promise<SchematicDocumentBundle>;
}

/**
 * Manifest-driven catalog service (R1.5, R2.16). Fetches the manifest, resolves
 * a `boardModel + boardRevision` key to a bundle entry (falling back to the
 * latest by `importedAt` when no revision is supplied), then hydrates the JSON
 * bundle back into a domain `SchematicDocument`.
 */
export class SchematicCatalogService {
  constructor(private readonly deps: SchematicCatalogServiceDeps) {}

  /**
   * Resolves a bundle entry for the given board model and optional revision.
   * When no revision is provided, the latest entry (by `importedAt`) for the
   * model is chosen. Returns a NO_COMPANION/NO_BUNDLE_FOUND result instead of
   * throwing when nothing matches.
   */
  public async resolve(
    boardModel: string,
    boardRevision?: string
  ): Promise<CatalogResolveResult> {
    const manifest = await this.deps.fetchManifest();
    const normalizedModel = boardModel.trim().toLowerCase();

    const candidates = manifest.entries.filter(
      (e) => e.boardModel.trim().toLowerCase() === normalizedModel
    );

    if (candidates.length === 0) {
      return { status: "NO_COMPANION", reason: "NO_BUNDLE_FOUND" };
    }

    let selected: ManifestEntry;
    if (boardRevision && boardRevision.trim().length > 0) {
      const normalizedRevision = boardRevision.trim().toLowerCase();
      const exact = candidates.find(
        (e) => e.boardRevision.trim().toLowerCase() === normalizedRevision
      );
      if (!exact) {
        return { status: "NO_COMPANION", reason: "NO_BUNDLE_FOUND" };
      }
      selected = exact;
    } else {
      // Fallback to latest by timestamp.
      selected = [...candidates].sort(
        (a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt)
      )[0];
    }

    return { status: "FOUND", entry: selected };
  }

  /** Fetches and hydrates the bundle referenced by a resolved entry. */
  public async hydrateBundle(entry: ManifestEntry): Promise<SchematicDocument> {
    const bundle = await this.deps.fetchBundle(entry);
    return HydrateBundle.hydrate(bundle);
  }
}
