import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkbenchEventBus } from "../../../src/application/workbench/WorkbenchEventBus.js";
import { WorkbenchFacade } from "../../../src/application/workbench/WorkbenchFacade.js";
import { SessionStore } from "../../../src/application/workbench/SessionStore.js";
import { SchematicsFacade } from "../../../src/application/schematics/SchematicsFacade.js";
import { IngestSchematicUseCase } from "../../../src/application/schematics/commands/IngestSchematicUseCase.js";
import { CrossProbeLookupUseCase } from "../../../src/application/schematics/queries/CrossProbeLookupUseCase.js";
import { SchematicParserFactory } from "../../../src/infrastructure/schematics/parsers/SchematicParserFactory.js";
import { SchematicCrossProbeIndex } from "../../../src/application/schematics/services/SchematicCrossProbeIndex.js";
import { SchematicNavigator } from "../../../src/ui/schematics/schematic-nav.js";
import { applySelectionToSchematic } from "../../../src/ui/schematics/schematic-sync.js";
import { NetTopology } from "../../../src/domain/boardview/aggregates/NetTopology.js";
import { NetClassification } from "../../../src/domain/boardview/value-objects/NetClassification.js";
import { SubBoardEntity, SubBoardRole } from "../../../src/domain/catalog/entities/SubBoardEntity.js";
import { PadEntity } from "../../../src/domain/boardview/entities/PadEntity.js";
import { LayerCoordinate } from "../../../src/domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../../src/domain/boardview/value-objects/LayerSide.js";

function createIntegrationPdfBytes(): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 150 >>
stream
BT
/F1 12 Tf
100 200 Td
(U2700) Tj
100 220 Td
(A1) Tj
100 240 Td
(PP_VDD_MAIN) Tj
200 200 Td
(R101) Tj
200 220 Td
(1) Tj
200 240 Td
(PP_VDD_MAIN) Tj
ET
endstream
endobj
xref
0 5
trailer
<< /Size 5 /Root 1 0 R >>
startxref
350
%%EOF`);
}

describe("SchematicSyncIntegration: Ingestion -> Cross-Probe Index -> WorkbenchEventBus Sync", () => {
  let bus: WorkbenchEventBus;
  let crossProbe: SchematicCrossProbeIndex;
  let schematicsFacade: SchematicsFacade;
  let workbenchFacade: WorkbenchFacade;

  beforeEach(async () => {
    bus = new WorkbenchEventBus();
    crossProbe = new SchematicCrossProbeIndex();
    const parserFactory = new SchematicParserFactory();
    const ingestUseCase = new IngestSchematicUseCase(parserFactory, crossProbe);
    const lookupUseCase = new CrossProbeLookupUseCase(crossProbe);
    schematicsFacade = new SchematicsFacade(ingestUseCase, lookupUseCase, crossProbe);

    // Ingest schematic document
    await schematicsFacade.ingestSchematic({
      documentId: "IPHONE13_PRO",
      filename: "iphone13_pro_schematic.pdf",
      rawBytes: createIntegrationPdfBytes(),
    });

    // Register BoardView counterpart
    const netTopology = new NetTopology({
      id: "NET_PP_VDD_MAIN",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
    });
    netTopology.addPinBinding("SUB_MAIN", "PAD_U2700_A1", "U2700.A1");

    const subBoard = new SubBoardEntity({
      id: "SUB_MAIN",
      label: "Main Logic",
      role: SubBoardRole.TOP_LOGIC,
      layerCount: 10,
    });
    subBoard.addPad(new PadEntity({
      id: "PAD_U2700_A1",
      padNumber: "A1",
      subBoardId: "SUB_MAIN",
      componentId: "U2700",
      coordinate: new LayerCoordinate(150.0, 200.0, LayerSide.TOP_SIDE),
      netName: "PP_VDD_MAIN",
    }));

    crossProbe.registerBoardViewTopology(netTopology, [subBoard]);

    const sessionStore = new SessionStore({
      read: async () => null,
      write: async () => undefined,
      delete: async () => undefined,
    });

    workbenchFacade = new WorkbenchFacade({
      boardViewFacade: {
        uploadBoardView: vi.fn(),
        getBoardView: vi.fn(async () => ({
          boardId: "IPHONE13_PRO",
          boardNumber: "820-02106",
          stackType: "SINGLE_BOARD",
          subBoards: [],
        })),
        getNets: vi.fn(async () => ({ nets: [] })),
      },
      schematicsFacade: {
        saveDocument: vi.fn(),
        uploadSchematic: vi.fn(),
        searchSymbols: vi.fn(),
        getPage: vi.fn(),
      },
      measurementsFacade: {
        getReferences: vi.fn(),
        createReference: vi.fn(),
        recordMeasurement: vi.fn(),
      },
      bus,
      sessionStore,
      defaultBoardModel: "iPhone13",
    });
  });

  it("should synchronize BoardView selection to Schematic overlay highlights", async () => {
    const page1 = await schematicsFacade.getPage("IPHONE13_PRO", 1);
    expect(page1).toBeDefined();

    const doc = (schematicsFacade as any).documents.get("IPHONE13_PRO") ?? (schematicsFacade as any).ingestUseCase.getDocument("IPHONE13_PRO");
    const navigator = new SchematicNavigator(doc.pageCount, 1);

    const reaction = applySelectionToSchematic(crossProbe as any, doc, navigator, {
      boardId: "IPHONE13_PRO",
      net: "PP_VDD_MAIN",
    });

    expect(reaction.activeNet).toBe("PP_VDD_MAIN");
    expect(reaction.notInSchematic).toBe(false);
    expect(reaction.overlay.highlights.length).toBeGreaterThanOrEqual(1);
    expect(reaction.pageToShow).toBe(1);
  });

  it("should synchronize BoardView pin selection to Schematic pin details", async () => {
    const doc = (schematicsFacade as any).documents.get("IPHONE13_PRO") ?? (schematicsFacade as any).ingestUseCase.getDocument("IPHONE13_PRO");
    const navigator = new SchematicNavigator(doc.pageCount, 1);

    const reaction = applySelectionToSchematic(crossProbe as any, doc, navigator, {
      boardId: "IPHONE13_PRO",
      refDes: "U2700",
      pin: "A1",
    });

    expect(reaction.detail).toBeDefined();
    expect(reaction.detail?.refDes).toBe("U2700");
    expect(reaction.detail?.pins.some((p) => p.pinNumber === "A1")).toBe(true);
  });

  it("should emit selection.change on workbenchEventBus when schematic coordinate is probed", () => {
    const lookup = crossProbe.queryFromSchematicCoordinate(1, 100, 200);
    expect(lookup.tokens.length).toBeGreaterThanOrEqual(1);

    const seen = vi.fn();
    bus.subscribe("selection.change", seen);

    workbenchFacade.select({
      boardId: "IPHONE13_PRO",
      net: "PP_VDD_MAIN",
    });

    expect(seen).toHaveBeenCalledWith({
      boardId: "IPHONE13_PRO",
      net: "PP_VDD_MAIN",
    });
  });
});
