import type { SchematicDocument } from "../../../domain/schematics/aggregates/SchematicDocument.js";
import type { TokenType } from "../../../domain/schematics/value-objects/VectorToken.js";

/** Plain-JSON representation of a 2D bounding box. */
export interface BundleBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Plain-JSON representation of a vector text token. */
export interface BundleToken {
  text: string;
  bounds: BundleBounds;
  fontSize: number;
  fontFamily?: string;
  rotation: number;
  tokenType: TokenType | string;
}

/** Plain-JSON representation of a net label match. */
export interface BundleNetLabel {
  netName: string;
  pageNumber: number;
  bounds: BundleBounds;
  rotation: number;
}

/** Plain-JSON representation of a schematic page. */
export interface BundlePage {
  pageNumber: number;
  width: number;
  height: number;
  tokens: BundleToken[];
  netLabels: BundleNetLabel[];
  symbols: unknown[];
}

/** JSON bundle schema for a serialized SchematicDocument (see design.md). */
export interface SchematicDocumentBundle {
  documentId: string;
  title: string;
  pageCount: number;
  sourceFilename?: string;
  importedAt: string;
  pages: BundlePage[];
}

export interface SerializeBundleOptions {
  sourceFilename?: string;
  importedAt?: string;
}

/** Serializes a domain SchematicDocument into a plain-JSON bundle. */
export class SchematicBundleSerializer {
  public static serialize(
    doc: SchematicDocument,
    options: SerializeBundleOptions = {}
  ): SchematicDocumentBundle {
    const pages: BundlePage[] = [];
    for (const page of [...doc.pages.values()].sort((a, b) => a.pageNumber - b.pageNumber)) {
      pages.push({
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        tokens: page.tokens.map((t) => ({
          text: t.text,
          bounds: {
            minX: t.bounds.minX,
            minY: t.bounds.minY,
            maxX: t.bounds.maxX,
            maxY: t.bounds.maxY,
          },
          fontSize: t.fontSize,
          fontFamily: t.fontFamily,
          rotation: t.rotation,
          tokenType: t.tokenType,
        })),
        netLabels: page.netLabels.map((l) => ({
          netName: l.netName,
          pageNumber: l.pageNumber,
          bounds: {
            minX: l.bounds.minX,
            minY: l.bounds.minY,
            maxX: l.bounds.maxX,
            maxY: l.bounds.maxY,
          },
          rotation: l.rotation,
        })),
        symbols: page.symbols,
      });
    }

    return {
      documentId: doc.documentId,
      title: doc.title,
      pageCount: doc.pageCount,
      sourceFilename: options.sourceFilename,
      importedAt: options.importedAt ?? new Date().toISOString(),
      pages,
    };
  }
}
