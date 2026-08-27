import { describe, it, expect, beforeEach } from "vitest";
import { SchematicCrossProbeIndex } from "../../../../src/domain/schematics/services/SchematicCrossProbeIndex.js";
import { SchematicDocument } from "../../../../src/domain/schematics/aggregates/SchematicDocument.js";
import { SchematicPage } from "../../../../src/domain/schematics/entities/SchematicPage.js";
import { SchematicSymbol } from "../../../../src/domain/schematics/entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../../../../src/domain/schematics/entities/SchematicPinLocation.js";
import { NetLabelMatch } from "../../../../src/domain/schematics/value-objects/NetLabelMatch.js";
import { VectorToken, TokenType } from "../../../../src/domain/schematics/value-objects/VectorToken.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { NetTopology } from "../../../../src/domain/boardview/aggregates/NetTopology.js";
import { NetClassification } from "../../../../src/domain/boardview/value-objects/NetClassification.js";
import { InterposerJunction } from "../../../../src/domain/boardview/value-objects/InterposerJunction.js";
import { SubBoardEntity, SubBoardRole } from "../../../../src/domain/catalog/entities/SubBoardEntity.js";
import { PadEntity } from "../../../../src/domain/boardview/entities/PadEntity.js";
import { LayerCoordinate } from "../../../../src/domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";

describe("SchematicCrossProbeIndex Domain Service", () => {
  let crossProbeIndex: SchematicCrossProbeIndex;
  let schematicDoc: SchematicDocument;
  let netTopology: NetTopology;
  let topSubBoard: SubBoardEntity;
  let botSubBoard: SubBoardEntity;

  beforeEach(() => {
    crossProbeIndex = new SchematicCrossProbeIndex();

    // 1. Setup Schematic Document
    schematicDoc = new SchematicDocument({
      documentId: "DOC_IPHONE13",
      title: "iPhone 13 Schematic",
      pageCount: 100,
    });

    const page12 = new SchematicPage({ pageNumber: 12, width: 1000, height: 800 });
    const symU2700A = new SchematicSymbol({
      id: "SYM_U2700_A",
      refDes: "U2700",
      bankDesignator: "A",
      pageNumber: 12,
      bounds: new BoundingBox2D(100, 100, 300, 300),
    });
    symU2700A.addPin(new SchematicPinLocation({
      id: "PIN_U2700_A12",
      refDes: "U2700",
      pinNumber: "A12",
      pinName: "PP_VDD_MAIN_IN",
      pageNumber: 12,
      bounds: new BoundingBox2D(180, 200, 195, 215),
      connectionPoint: { x: 180, y: 207.5 },
      connectedNetName: "PP_VDD_MAIN",
    }));

    page12.addSymbol(symU2700A);
    page12.addNetLabel(new NetLabelMatch({
      netName: "PP_VDD_MAIN",
      pageNumber: 12,
      bounds: new BoundingBox2D(200, 200, 280, 215),
    }));
    page12.addToken(new VectorToken({
      text: "PP_VDD_MAIN",
      pageNumber: 12,
      bounds: new BoundingBox2D(200, 200, 280, 215),
      fontSize: 8,
      tokenType: TokenType.NET_LABEL,
    }));
    page12.addToken(new VectorToken({
      text: "A12",
      pageNumber: 12,
      bounds: new BoundingBox2D(180, 200, 195, 215),
      fontSize: 8,
      tokenType: TokenType.PIN_NUM,
    }));
    schematicDoc.addPage(page12);
    schematicDoc.registerSymbol(symU2700A);

    // 2. Setup BoardView Topology & SubBoards
    netTopology = new NetTopology({
      id: "NET_PP_VDD_MAIN",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
    });
    netTopology.addPinBinding("SUB_TOP", "PAD_U2700_A12", "U2700.A12");
    netTopology.addPinBinding("SUB_BOT", "PAD_U_BB_C4", "U_BB_PMU.C4");
    netTopology.addInterposerJunction(new InterposerJunction({
      junctionId: "JUNC_INT_084",
      interposerPadId: "INT_PAD_084",
      topPadId: "PAD_INT_TOP_84",
      bottomPadId: "PAD_INT_BOT_84",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
    }));

    topSubBoard = new SubBoardEntity({
      id: "SUB_TOP",
      label: "Top Logic",
      role: SubBoardRole.TOP_LOGIC,
      layerCount: 10,
    });
    topSubBoard.addPad(new PadEntity({
      id: "PAD_U2700_A12",
      padNumber: "A12",
      subBoardId: "SUB_TOP",
      componentId: "U2700",
      coordinate: new LayerCoordinate(50.0, 60.0, LayerSide.TOP_SIDE),
      netName: "PP_VDD_MAIN",
    }));

    botSubBoard = new SubBoardEntity({
      id: "SUB_BOT",
      label: "Bottom RF",
      role: SubBoardRole.BOTTOM_RF,
      layerCount: 10,
    });
    botSubBoard.addPad(new PadEntity({
      id: "PAD_U_BB_C4",
      padNumber: "C4",
      subBoardId: "SUB_BOT",
      componentId: "U_BB_PMU",
      coordinate: new LayerCoordinate(55.0, 65.0, LayerSide.BOTTOM_SIDE),
      netName: "PP_VDD_MAIN",
    }));

    crossProbeIndex.registerSchematicDocument(schematicDoc);
    crossProbeIndex.registerBoardViewTopology(netTopology, [topSubBoard, botSubBoard]);
  });

  it("should query from BoardView pin (U2700, A12) to Schematic pin hits", () => {
    const hits = crossProbeIndex.queryFromBoardViewPin("U2700", "A12");
    expect(hits).toHaveLength(1);
    expect(hits[0].pageNumber).toBe(12);
    expect(hits[0].refDes).toBe("U2700");
    expect(hits[0].pinNumber).toBe("A12");
    expect(hits[0].netName).toBe("PP_VDD_MAIN");
  });

  it("should query from BoardView net (PP_VDD_MAIN) to Schematic net labels", () => {
    const netLabels = crossProbeIndex.queryFromBoardViewNet("PP_VDD_MAIN");
    expect(netLabels).toHaveLength(1);
    expect(netLabels[0].pageNumber).toBe(12);
    expect(netLabels[0].netName).toBe("PP_VDD_MAIN");
  });

  it("should query from Schematic coordinate to BoardView pads, junctions and net", () => {
    const res = crossProbeIndex.queryFromSchematicCoordinate(12, 185, 205);
    expect(res.netName).toBe("PP_VDD_MAIN");
    expect(res.pinHits).toHaveLength(2); // Top pad & Bottom pad
    expect(res.pinHits.map((p) => p.padId)).toContain("PAD_U2700_A12");
    expect(res.interposerJunctions).toHaveLength(1);
    expect(res.interposerJunctions[0].interposerPadId).toBe("INT_PAD_084");
  });
});
