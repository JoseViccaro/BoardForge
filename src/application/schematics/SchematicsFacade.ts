import { SchematicDocument } from "../../domain/schematics/aggregates/SchematicDocument.js";
import { SchematicPage } from "../../domain/schematics/entities/SchematicPage.js";
import { EntityNotFoundError } from "../../interfaces/http/errors/HttpErrors.js";

export class SchematicsFacade {
  private readonly documents: Map<string, SchematicDocument> = new Map();

  public saveDocument(doc: SchematicDocument): void {
    this.documents.set(doc.documentId, doc);
  }

  public async uploadSchematic(
    schematicId: string,
    file: { filename: string; buffer: Buffer },
    organizationId?: string
  ): Promise<{ schematicId: string; filename: string; pageCount: number }> {
    const doc = new SchematicDocument({
      documentId: schematicId,
      title: file.filename,
      pageCount: 1,
    });
    this.documents.set(schematicId, doc);
    return {
      schematicId,
      filename: file.filename,
      pageCount: doc.pageCount,
    };
  }

  public async searchSymbols(
    schematicId: string,
    query: string,
    organizationId?: string
  ): Promise<{ matches: any[] }> {
    const doc = this.documents.get(schematicId);
    if (!doc) {
      throw new EntityNotFoundError(`Schematic document '${schematicId}' not found.`);
    }

    const matches: any[] = [];
    const normalizedQuery = query.toLowerCase();

    for (const page of doc.pages.values()) {
      for (const sym of page.symbols) {
        if (
          sym.refDes.toLowerCase().includes(normalizedQuery) ||
          sym.pins.some((p) => p.connectedNetName?.toLowerCase().includes(normalizedQuery))
        ) {
          matches.push({
            symbolId: sym.id,
            refDes: sym.refDes,
            pageNumber: sym.pageNumber,
            bounds: sym.bounds,
            pins: sym.pins.map((p) => ({
              pinNumber: p.pinNumber,
              pinName: p.pinName,
              netName: p.connectedNetName,
              bounds: p.bounds,
            })),
          });
        }
      }

      for (const netLabel of page.netLabels) {
        if (netLabel.netName.toLowerCase().includes(normalizedQuery)) {
          matches.push({
            netName: netLabel.netName,
            pageNumber: netLabel.pageNumber,
            bounds: netLabel.bounds,
          });
        }
      }
    }

    return { matches };
  }

  public async getPage(
    schematicId: string,
    pageNumber: number,
    organizationId?: string
  ): Promise<any> {
    const doc = this.documents.get(schematicId);
    if (!doc) {
      throw new EntityNotFoundError(`Schematic document '${schematicId}' not found.`);
    }

    const page = doc.getPage(pageNumber);
    if (!page) {
      throw new EntityNotFoundError(
        `Page ${pageNumber} of schematic '${schematicId}' not found.`
      );
    }

    return {
      schematicId: doc.documentId,
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
      symbols: page.symbols.map((s) => ({
        id: s.id,
        refDes: s.refDes,
        bankDesignator: s.bankDesignator,
        bounds: s.bounds,
        pins: s.pins.map((p) => ({
          pinNumber: p.pinNumber,
          pinName: p.pinName,
          bounds: p.bounds,
          netName: p.connectedNetName,
        })),
      })),
      tokens: page.tokens,
    };
  }
}
