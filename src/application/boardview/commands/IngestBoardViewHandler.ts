import { ICompositeBoardRepository } from "../../../domain/catalog/repositories/ICompositeBoardRepository.js";
import { INetTopologyRepository } from "../../../domain/boardview/repositories/INetTopologyRepository.js";
import { IBoardViewParserFactory } from "../../../domain/boardview/ports/IBoardViewParser.js";
import { BoardViewToCanonicalTransformer } from "../../../domain/boardview/services/BoardViewToCanonicalTransformer.js";
import { IngestBoardViewCommand } from "./IngestBoardViewCommand.js";
import { IngestBoardViewResultDto } from "../dtos/IngestBoardViewResultDto.js";
import { ParseDiagnostic } from "../../../domain/boardview/value-objects/BoardViewFormat.js";
import { RawBoardViewDocument } from "../../../domain/boardview/intermediate/RawBoardViewDocument.js";
import { BoardId } from "../../../domain/catalog/value-objects/BoardId.js";
import { SubBoardId } from "../../../domain/catalog/value-objects/SubBoardId.js";

export class IngestBoardViewHandler {
  constructor(
    private readonly compositeBoardRepo: ICompositeBoardRepository,
    private readonly topologyRepo: INetTopologyRepository,
    private readonly parserFactory: IBoardViewParserFactory,
    private readonly transformer: BoardViewToCanonicalTransformer
  ) {}

  public async execute(command: IngestBoardViewCommand): Promise<IngestBoardViewResultDto> {
    if (!command.boardId || command.boardId.trim().length === 0) {
      throw new Error("boardId cannot be empty");
    }
    if (!command.files || command.files.length === 0) {
      throw new Error("At least one board file must be provided for ingestion");
    }

    const allDiagnostics: ParseDiagnostic[] = [];
    const parsedDocs: { subBoardId: string; subBoardLabel: string; doc: RawBoardViewDocument }[] = [];

    for (const fileInput of command.files) {
      const contentBytes = typeof fileInput.content === "string"
        ? new TextEncoder().encode(fileInput.content)
        : fileInput.content;

      const parser = fileInput.format
        ? this.parserFactory.getParser(fileInput.format)
        : this.parserFactory.detectParser(contentBytes, fileInput.filename);

      const parseResult = await parser.parse(fileInput.content, {
        subBoardName: fileInput.subBoardLabel,
        sourceFilename: fileInput.filename
      });

      allDiagnostics.push(...parseResult.diagnostics);

      if (!parseResult.success) {
        return {
          boardId: command.boardId,
          boardNumber: command.boardNumber || command.boardId,
          stackType: "UNKNOWN",
          subBoardCount: 0,
          totalComponents: 0,
          totalPads: 0,
          totalNets: 0,
          diagnostics: allDiagnostics,
          success: false
        };
      }

      parsedDocs.push({
        subBoardId: fileInput.subBoardId,
        subBoardLabel: fileInput.subBoardLabel,
        doc: parseResult.document
      });
    }

    const boardId = new BoardId(command.boardId);

    if (parsedDocs.length === 1) {
      const single = parsedDocs[0];
      const result = this.transformer.transformSingleBoard({
        boardId,
        subBoardId: new SubBoardId(single.subBoardId),
        subBoardLabel: single.subBoardLabel,
        document: single.doc
      });

      await this.compositeBoardRepo.save(result.compositeBoard);
      for (const topology of result.netTopologies.values()) {
        await this.topologyRepo.save(topology);
      }

      return {
        boardId: boardId.value,
        boardNumber: result.compositeBoard.boardNumber,
        stackType: result.compositeBoard.stackType,
        subBoardCount: 1,
        totalComponents: result.subBoard.components.length,
        totalPads: result.subBoard.pads.length,
        totalNets: result.netTopologies.size,
        diagnostics: allDiagnostics,
        success: true
      };
    } else {
      // Multi-board sandwich pairing (Top + Bottom)
      const top = parsedDocs[0];
      const bot = parsedDocs[1];

      const result = this.transformer.transformSandwich({
        boardId,
        topSubBoardId: new SubBoardId(top.subBoardId),
        topSubBoardLabel: top.subBoardLabel,
        topDocument: top.doc,
        bottomSubBoardId: new SubBoardId(bot.subBoardId),
        bottomSubBoardLabel: bot.subBoardLabel,
        bottomDocument: bot.doc,
        interposerMappings: command.interposerMappings
      });

      await this.compositeBoardRepo.save(result.compositeBoard);
      for (const topology of result.netTopologies.values()) {
        await this.topologyRepo.save(topology);
      }

      const totalComponents = result.topSubBoard.components.length + result.bottomSubBoard.components.length;
      const totalPads = result.topSubBoard.pads.length + result.bottomSubBoard.pads.length;

      return {
        boardId: boardId.value,
        boardNumber: result.compositeBoard.boardNumber,
        stackType: result.compositeBoard.stackType,
        subBoardCount: 2,
        totalComponents,
        totalPads,
        totalNets: result.netTopologies.size,
        diagnostics: allDiagnostics,
        success: true
      };
    }
  }
}
