import { describe, it, expect, beforeEach } from "vitest";
import { IngestBoardViewHandler } from "../../../src/application/boardview/commands/IngestBoardViewHandler.js";
import { InMemoryCompositeBoardRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryCompositeBoardRepository.js";
import { InMemoryNetTopologyRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryNetTopologyRepository.js";
import { BoardViewParserFactory } from "../../../src/infrastructure/boardview/parsers/BoardViewParserFactory.js";
import { BoardViewToCanonicalTransformer } from "../../../src/domain/boardview/services/BoardViewToCanonicalTransformer.js";
import { NetClassification } from "../../../src/domain/boardview/value-objects/NetClassification.js";
import { BoardStackType } from "../../../src/domain/catalog/value-objects/BoardStackType.js";

describe("IngestBoardViewHandler Integration", () => {
  let compositeBoardRepo: InMemoryCompositeBoardRepository;
  let topologyRepo: InMemoryNetTopologyRepository;
  let handler: IngestBoardViewHandler;

  beforeEach(() => {
    compositeBoardRepo = new InMemoryCompositeBoardRepository();
    topologyRepo = new InMemoryNetTopologyRepository();
    const parserFactory = new BoardViewParserFactory();
    const transformer = new BoardViewToCanonicalTransformer();

    handler = new IngestBoardViewHandler(
      compositeBoardRepo,
      topologyRepo,
      parserFactory,
      transformer
    );
  });

  it("should ingest a single GenCAD board file into repositories and return summary DTO", async () => {
    const gencadContent = `
$HEADER
GENCAD 1.4
UNITS MM
$ENDHEADER
$BOARD
LINE 0.0 0.0 50.0 0.0
LINE 50.0 0.0 50.0 30.0
$ENDBOARD
$COMPONENTS
COMPONENT U1
PLACE 10.0 20.0
LAYER TOP
$ENDCOMPONENTS
$PINS
PIN U1 1 9.5 20.0 TOP
PIN U1 2 10.5 20.0 TOP
$ENDPINS
$SIGNALS
SIGNAL PP_VDD_MAIN
NODE U1 1
SIGNAL GND
NODE U1 2
$ENDSIGNALS
`;

    const result = await handler.execute({
      boardId: "BOARD_GENCAD_SINGLE",
      files: [
        {
          subBoardId: "SUB_LOGIC",
          subBoardLabel: "Single Logic",
          content: gencadContent,
          filename: "board.cad"
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(result.boardId).toBe("BOARD_GENCAD_SINGLE");
    expect(result.subBoardCount).toBe(1);
    expect(result.totalComponents).toBe(1);
    expect(result.totalPads).toBe(2);
    expect(result.totalNets).toBe(2);

    const savedBoard = await compositeBoardRepo.findById("BOARD_GENCAD_SINGLE");
    expect(savedBoard).toBeDefined();
    expect(savedBoard?.subBoards.length).toBe(1);

    const vddTopology = await topologyRepo.findByCanonicalNetName("BOARD_GENCAD_SINGLE", "PP_VDD_MAIN");
    expect(vddTopology).toBeDefined();
    expect(vddTopology?.classification).toBe(NetClassification.POWER_MAIN);
  });

  it("should ingest a sandwich pair of boards (Top + Bottom) and assemble SANDWICH_INTERPOSER", async () => {
    const topGencad = `
$HEADER
GENCAD 1.4
$ENDHEADER
$COMPONENTS
COMPONENT U2700
PLACE 20.0 20.0
$ENDCOMPONENTS
$PINS
PIN U2700 1 20.0 20.0 TOP
PIN U2700 PAD_084 50.0 50.0 BOTTOM
$ENDPINS
$SIGNALS
SIGNAL PP_VDD_MAIN
NODE U2700 1
NODE U2700 PAD_084
$ENDSIGNALS
`;

    const bottomBdv = `
#FORMAT: BDV
#COMPONENTS
UBBPMU 20.0 20.0 0 BOTTOM
#PINS
UBBPMU 1 20.0 20.0 BOTTOM PP_VDD_MAIN
UBBPMU PAD_084 50.0 50.0 TOP PP_VDD_MAIN
`;

    const result = await handler.execute({
      boardId: "BOARD_IPHONE_13_INGEST",
      files: [
        {
          subBoardId: "SUB_TOP",
          subBoardLabel: "Top Logic",
          content: topGencad,
          filename: "top.cad"
        },
        {
          subBoardId: "SUB_BOT",
          subBoardLabel: "Bottom RF",
          content: bottomBdv,
          filename: "bot.bdv"
        }
      ],
      interposerMappings: [
        {
          junctionId: "JUNC_084",
          interposerPadId: "PAD_084",
          netName: "PP_VDD_MAIN",
          classification: NetClassification.POWER_MAIN
        }
      ]
    });

    expect(result.success).toBe(true);
    expect(result.stackType).toBe(BoardStackType.SANDWICH_INTERPOSER);
    expect(result.subBoardCount).toBe(2);

    const savedBoard = await compositeBoardRepo.findById("BOARD_IPHONE_13_INGEST");
    expect(savedBoard?.subBoards.length).toBe(2);

    const vddTopology = await topologyRepo.findByCanonicalNetName("BOARD_IPHONE_13_INGEST", "PP_VDD_MAIN");
    expect(vddTopology?.interposerJunctions.length).toBe(1);
    expect(vddTopology?.interposerJunctions[0].junctionId).toBe("JUNC_084");
  });
});
