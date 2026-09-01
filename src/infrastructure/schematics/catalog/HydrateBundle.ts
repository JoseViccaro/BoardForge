import { SchematicDocument } from "../../../domain/schematics/aggregates/SchematicDocument.js";
import { SchematicPage } from "../../../domain/schematics/entities/SchematicPage.js";
import { VectorToken, TokenType } from "../../../domain/schematics/value-objects/VectorToken.js";
import { BoundingBox2D } from "../../../domain/schematics/value-objects/BoundingBox2D.js";
import { NetLabelMatch } from "../../../domain/schematics/value-objects/NetLabelMatch.js";
import type { SchematicDocumentBundle } from "./SchematicBundleSerializer.js";

/**
 * Net-label / refdes / pin heuristic from design.md. A token is classified
 * purely from its text:
 *
 *  - NET_LABEL: all-caps net names (>=3 chars, `[A-Z0-9_]+`) that carry an
 *    underscore (PP_VDD_MAIN) or are pure-letter power rails (VCC, GND).
 *  - DESIGNATOR: refdes shape `[A-Z][A-Z0-9]+[0-9]+` with a numeric part of
 *    3+ digits (U2700, R2700).
 *  - PIN_NUM: single leading letter with a short 1-2 digit numeric part,
 *    optionally a trailing letter (A12, A1, B2C).
 *  - TEXT: everything else.
 *
 * Note: the design regexes overlap for `[letter][digits]` tokens (both U2700
 * and A12 match DESIGNATOR and PIN_NUM shapes). We disambiguate by numeric-part
 * length so the documented examples classify as intended: long refdes numbers
 * (>=3 digits) are designators, short pin suffixes (1-2 digits) are pin nums.
 */
export function classifyTokenType(text: string): TokenType {
  const t = text.trim();
  if (t.length === 0) {
    return TokenType.TEXT;
  }
  const isAllCapsToken = t === t.toUpperCase() && t.length >= 3 && /^[A-Z0-9_]+$/.test(t);

  if (isAllCapsToken && (t.includes("_") || /^[A-Z]+$/.test(t))) {
    return TokenType.NET_LABEL;
  }

  if (/^[A-Z][A-Z0-9]+[0-9]+$/.test(t)) {
    if (/^[A-Z][0-9]{1,2}[A-Z]?$/.test(t)) {
      return TokenType.PIN_NUM;
    }
    return TokenType.DESIGNATOR;
  }

  if (/^[A-Z][0-9]+[A-Z]*$/.test(t)) {
    return TokenType.PIN_NUM;
  }

  return TokenType.TEXT;
}

/** Reconstructs a domain SchematicDocument from a JSON bundle. */
export class HydrateBundle {
  public static hydrate(bundle: SchematicDocumentBundle): SchematicDocument {
    const doc = new SchematicDocument({
      documentId: bundle.documentId,
      title: bundle.title,
      pageCount: bundle.pageCount,
    });

    for (const pageData of bundle.pages) {
      const page = new SchematicPage({
        pageNumber: pageData.pageNumber,
        width: pageData.width,
        height: pageData.height,
      });

      for (const tokenData of pageData.tokens) {
        const bounds = new BoundingBox2D(
          tokenData.bounds.minX,
          tokenData.bounds.minY,
          tokenData.bounds.maxX,
          tokenData.bounds.maxY
        );
        const token = new VectorToken({
          text: tokenData.text,
          pageNumber: pageData.pageNumber,
          bounds,
          fontSize: tokenData.fontSize,
          fontFamily: tokenData.fontFamily,
          rotation: tokenData.rotation,
          // Re-derive the classification from text so the heuristic is the
          // source of truth for tokenType after hydration.
          tokenType: classifyTokenType(tokenData.text),
        });
        page.addToken(token);
      }

      for (const labelData of pageData.netLabels) {
        page.addNetLabel(
          new NetLabelMatch({
            netName: labelData.netName,
            pageNumber: labelData.pageNumber,
            bounds: new BoundingBox2D(
              labelData.bounds.minX,
              labelData.bounds.minY,
              labelData.bounds.maxX,
              labelData.bounds.maxY
            ),
            rotation: labelData.rotation,
          })
        );
      }

      doc.addPage(page);
    }

    return doc;
  }
}
