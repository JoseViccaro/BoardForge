import { SchematicDocument } from "../../domain/schematics/aggregates/SchematicDocument.js";
import { SchematicPage } from "../../domain/schematics/entities/SchematicPage.js";
import { EntityNotFoundError } from "../../interfaces/http/errors/HttpErrors.js";
import { SchematicParserFactory } from "../../infrastructure/schematics/parsers/SchematicParserFactory.js";
import { SchematicCrossProbeIndex } from "./services/SchematicCrossProbeIndex.js";
import {
  IngestSchematicUseCase,
  IngestSchematicCommand,
  IngestSchematicResultDto,
} from "./commands/IngestSchematicUseCase.js";
import { CrossProbeLookupUseCase } from "./queries/CrossProbeLookupUseCase.js";
import type {
  ISchematicCrossProbeIndex,
  SchematicPinHit,
  SchematicCoordinateLookupResult,
} from "../../domain/schematics/ports/ISchematicCrossProbeIndex.js";
import { NetLabelMatch } from "../../domain/schematics/value-objects/NetLabelMatch.js";

export type { IngestSchematicCommand, IngestSchematicResultDto };

export class SchematicsFacade {
  private readonly documents: Map<string, SchematicDocument> = new Map();
  private readonly crossProbeIndex: ISchematicCrossProbeIndex;
  private readonly ingestUseCase: IngestSchematicUseCase;
  private readonly lookupUseCase: CrossProbeLookupUseCase;

  constructor(
    ingestUseCase?: IngestSchematicUseCase,
    lookupUseCase?: CrossProbeLookupUseCase,
    crossProbeIndex?: ISchematicCrossProbeIndex
  ) {
    this.crossProbeIndex = crossProbeIndex ?? new SchematicCrossProbeIndex();
    this.ingestUseCase =
      ingestUseCase ??
      new IngestSchematicUseCase(
        new SchematicParserFactory(),
        this.crossProbeIndex,
        (doc) => this.saveDocument(doc)
      );
    this.lookupUseCase = lookupUseCase ?? new CrossProbeLookupUseCase(this.crossProbeIndex);
  }

  public getCrossProbeIndex(): ISchematicCrossProbeIndex {
    return this.crossProbeIndex;
  }

  public saveDocument(doc: SchematicDocument): void {
    this.documents.set(doc.documentId, doc);
    this.crossProbeIndex.registerSchematicDocument(doc);
  }

  public async ingestSchematic(command: IngestSchematicCommand): Promise<IngestSchematicResultDto> {
    const result = await this.ingestUseCase.execute(command);
    return result;
  }

  public lookupPin(refDes: string, pinNumber: string): SchematicPinHit[] {
    return this.lookupUseCase.lookupByPin(refDes, pinNumber);
  }

  public lookupNet(netName: string): NetLabelMatch[] {
    return this.lookupUseCase.lookupByNet(netName);
  }

  public lookupCoordinate(
    pageNumber: number,
    x: number,
    y: number
  ): SchematicCoordinateLookupResult {
    return this.lookupUseCase.lookupByCoordinate(pageNumber, x, y);
  }

  public async uploadSchematic(
    schematicId: string,
    file: { filename: string; buffer: Buffer | Uint8Array },
    organizationId?: string
  ): Promise<{ schematicId: string; filename: string; pageCount: number }> {
    try {
      const result = await this.ingestSchematic({
        documentId: schematicId,
        filename: file.filename,
        rawBytes: new Uint8Array(file.buffer),
        organizationId,
      });
      return {
        schematicId: result.documentId,
        filename: file.filename,
        pageCount: result.pageCount,
      };
    } catch {
      const doc = new SchematicDocument({
        documentId: schematicId,
        title: file.filename,
        pageCount: 1,
      });
      this.saveDocument(doc);
      return {
        schematicId,
        filename: file.filename,
        pageCount: doc.pageCount,
      };
    }
  }

  public async searchSymbols(
    schematicId: string,
    query: string,
    organizationId?: string
  ): Promise<{ matches: any[] }> {
    const doc = this.documents.get(schematicId) ?? this.ingestUseCase.getDocument(schematicId);
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
    const doc = this.documents.get(schematicId) ?? this.ingestUseCase.getDocument(schematicId);
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
