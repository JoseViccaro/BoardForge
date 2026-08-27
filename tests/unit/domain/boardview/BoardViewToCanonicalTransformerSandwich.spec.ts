import { describe, it, expect } from "vitest";
import { BoardViewToCanonicalTransformer } from "../../../../src/domain/boardview/services/BoardViewToCanonicalTransformer.js";
import { RawBoardViewDocument } from "../../../../src/domain/boardview/intermediate/RawBoardViewDocument.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";
import { BoardId } from "../../../../src/domain/catalog/value-objects/BoardId.js";
import { SubBoardId } from "../../../../src/domain/catalog/value-objects/SubBoardId.js";
import { BoardStackType } from "../../../../src/domain/catalog/value-objects/BoardStackType.js";
import { NetClassification } from "../../../../src/domain/boardview/value-objects/NetClassification.js";

describe("BoardViewToCanonicalTransformer Sandwich Pairing", () => {
  const transformer = new BoardViewToCanonicalTransformer();

  it("should transform Top Logic and Bottom RF documents into SANDWICH_INTERPOSER CompositeBoard with InterposerJunctions", () => {
    const topDoc: RawBoardViewDocument = {
      format: "GENCAD",
      name: "TopLogic",
      outline: { width: 100, height: 60, polygon: [] },
      components: [
        {
          refDes: "U2700",
          x: 20,
          y: 30,
          rotation: 0,
          side: LayerSide.TOP_SIDE,
          pins: [
            { pinRef: "A12", componentRefDes: "U2700", x: 20, y: 30, side: LayerSide.TOP_SIDE, netName: "PP_VDD_MAIN" }
          ]
        },
        {
          refDes: "INTERPOSER_TOP",
          x: 50,
          y: 30,
          rotation: 0,
          side: LayerSide.BOTTOM_SIDE,
          pins: [
            { pinRef: "PAD_084", componentRefDes: "INTERPOSER_TOP", x: 50, y: 30, side: LayerSide.BOTTOM_SIDE, netName: "PP_VDD_MAIN" }
          ]
        }
      ],
      nails: [],
      diagnostics: []
    };

    const bottomDoc: RawBoardViewDocument = {
      format: "GENCAD",
      name: "BottomRF",
      outline: { width: 100, height: 60, polygon: [] },
      components: [
        {
          refDes: "UBBPMU",
          x: 20,
          y: 30,
          rotation: 0,
          side: LayerSide.BOTTOM_SIDE,
          pins: [
            { pinRef: "C4", componentRefDes: "UBBPMU", x: 20, y: 30, side: LayerSide.BOTTOM_SIDE, netName: "PP_VDD_MAIN" }
          ]
        },
        {
          refDes: "INTERPOSER_BOT",
          x: 50,
          y: 30,
          rotation: 0,
          side: LayerSide.TOP_SIDE,
          pins: [
            { pinRef: "PAD_084", componentRefDes: "INTERPOSER_BOT", x: 50, y: 30, side: LayerSide.TOP_SIDE, netName: "PP_VDD_MAIN" }
          ]
        }
      ],
      nails: [],
      diagnostics: []
    };

    const result = transformer.transformSandwich({
      boardId: new BoardId("BOARD_IPHONE_13_SANDWICH"),
      topSubBoardId: new SubBoardId("SUB_TOP_LOGIC"),
      topSubBoardLabel: "iPhone 13 Top Logic",
      topDocument: topDoc,
      bottomSubBoardId: new SubBoardId("SUB_BOT_RF"),
      bottomSubBoardLabel: "iPhone 13 Bottom RF",
      bottomDocument: bottomDoc,
      interposerMappings: [
        {
          junctionId: "JUNC_084",
          interposerPadId: "PAD_084",
          topComponentRef: "INTERPOSER_TOP",
          topPinRef: "PAD_084",
          bottomComponentRef: "INTERPOSER_BOT",
          bottomPinRef: "PAD_084",
          netName: "PP_VDD_MAIN",
          classification: NetClassification.POWER_MAIN
        }
      ]
    });

    expect(result.compositeBoard.stackType).toBe(BoardStackType.SANDWICH_INTERPOSER);
    expect(result.compositeBoard.subBoards.length).toBe(2);

    const vddTopology = result.netTopologies.get("PP_VDD_MAIN")!;
    expect(vddTopology).toBeDefined();
    expect(vddTopology.interposerJunctions.length).toBe(1);

    const junc = vddTopology.interposerJunctions[0];
    expect(junc.junctionId).toBe("JUNC_084");
    expect(junc.canonicalNetName).toBe("PP_VDD_MAIN");
    expect(junc.isBridge()).toBe(true);
  });
});
