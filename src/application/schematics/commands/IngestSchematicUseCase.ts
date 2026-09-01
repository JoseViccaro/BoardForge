import { SchematicParserFactory } from "../../../infrastructure/schematics/parsers/SchematicParserFactory.js";
import { ISchematicCrossProbeIndex } from "../../../domain/schematics/ports/ISchematicCrossProbeIndex.js";
import { ParseDiagnostic } from "../../../domain/schematics/ports/ISchematicParser.js";
import { SchematicDocument } from "../../../domain/schematics/aggregates/SchematicDocument.js";
import {
  UnsupportedFormatError,
  CorruptedStreamError,
} from "../../../infrastructure/schematics/parsers/VectorPdfSchematicParser.js";

export interface IngestSchematicCommand {
  documentId: string;
  filename: string;
  rawBytes: Uint8Array;
  organizationId?: string;
}

export interface IngestSchematicResultDto {
  documentId: string;
  pageCount: number;
  symbolCount: number;
  netCount: number;
  diagnostics: ParseDiagnostic[];
}

export class IngestSchematicUseCase {
  private readonly documents: Map<string, SchematicDocument> = new Map();

  constructor(
    private readonly parserFactory: SchematicParserFactory,
    private readonly crossProbeIndex?: ISchematicCrossProbeIndex,
    private readonly onDocumentIngested?: (doc: SchematicDocument) => void
  ) {}

  public getDocument(documentId: string): SchematicDocument | undefined {
    return this.documents.get(documentId);
  }

  public async execute(command: IngestSchematicCommand): Promise<IngestSchematicResultDto> {
    const parser = this.parserFactory.detectParser(command.rawBytes, command.filename);
    const parseResult = await parser.parse(command.rawBytes, {
      sourceFilename: command.filename,
      boardModel: command.documentId,
    });

    if (!parseResult.ok) {
      if (parseResult.error.code === "UNSUPPORTED_FORMAT") {
        throw new UnsupportedFormatError(parseResult.error.message);
      }
      if (parseResult.error.code === "CORRUPTED_STREAM") {
        throw new CorruptedStreamError(parseResult.error.message);
      }
      throw new Error(`Failed to parse schematic: ${parseResult.error.message}`);
    }

    const doc = parseResult.document;
    this.documents.set(doc.documentId, doc);

    if (this.crossProbeIndex) {
      this.crossProbeIndex.registerSchematicDocument(doc);
    }

    if (this.onDocumentIngested) {
      this.onDocumentIngested(doc);
    }

    let symbolCount = 0;
    let netCount = 0;

    for (const page of doc.pages.values()) {
      symbolCount += page.symbols.length;
      netCount += page.netLabels.length;
    }

    return {
      documentId: doc.documentId,
      pageCount: doc.sheetCount,
      symbolCount,
      netCount,
      diagnostics: parseResult.diagnostics,
    };
  }
}
