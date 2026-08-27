import { describe, it, expect } from "vitest";
import { BoardViewToCanonicalTransformer } from "../../../../src/domain/boardview/services/BoardViewToCanonicalTransformer.js";
import { RawBoardViewDocument } from "../../../../src/domain/boardview/intermediate/RawBoardViewDocument.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";
import { BoardId } from "../../../../src/domain/catalog/value-objects/BoardId.js";
import { SubBoardId } from "../../../../src/domain/catalog/value-objects/SubBoardId.js";
import { BoardStackType } from "../../../../src/domain/catalog/value-objects/BoardStackType.js";
import { NetClassification } from "../../../../src/domain/boardview/value-objects/NetClassification.js";

describe("BoardViewToCanonicalTransformer", () => {
  const transformer = new BoardViewToCanonicalTransformer();

  it("should transform single RawBoardViewDocument into SubBoardEntity, CompositeBoard, and NetTopologies", () => {
    const rawDoc: RawBoardViewDocument = {
      format: "GENCAD",
      name: "MainLogic",
      outline: {
        width: 100.0,
        height: 60.0,
        polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }]
      },
      components: [
        {
          refDes: "U2700",
          package: "BGA",
          x: 25.0,
          y: 30.0,
          rotation: 0,
          side: LayerSide.TOP_SIDE,
          pins: [
            {
              pinRef: "A1",
              componentRefDes: "U2700",
              x: 24.5,
              y: 29.5,
              side: LayerSide.TOP_SIDE,
              netName: "PP_VDD_MAIN"
            },
            {
              pinRef: "A2",
              componentRefDes: "U2700",
              x: 25.5,
              y: 29.5,
              side: LayerSide.TOP_SIDE,
              netName: "GND"
            }
          ]
        }
      ],
      nails: [
        {
          id: "TP101",
          x: 50.0,
          y: 40.0,
          side: LayerSide.TOP_SIDE,
          netName: "PP_VDD_MAIN"
        }
      ],
      diagnostics: []
    };

    const boardId = new BoardId("BOARD_IPHONE_13");
    const subBoardId = new SubBoardId("SUB_MAIN_LOGIC");

    const result = transformer.transformSingleBoard({
      boardId,
      subBoardId,
      subBoardLabel: "iPhone 13 Main Board",
      document: rawDoc
    });

    expect(result.compositeBoard).toBeDefined();
    expect(result.compositeBoard.id.value).toBe("BOARD_IPHONE_13");
    expect(result.compositeBoard.stackType).toBe(BoardStackType.SINGLE_LAYER);

    expect(result.subBoard.id.value).toBe("SUB_MAIN_LOGIC");
    expect(result.subBoard.label).toBe("iPhone 13 Main Board");
    expect(result.subBoard.components.length).toBe(1);
    expect(result.subBoard.pads.length).toBe(3); // 2 pins + 1 nail

    const comp = result.subBoard.components[0];
    expect(comp.designator).toBe("U2700");

    const topMap = result.netTopologies;
    expect(topMap.has("PP_VDD_MAIN")).toBe(true);
    expect(topMap.has("GND")).toBe(true);

    const vddTopology = topMap.get("PP_VDD_MAIN")!;
    expect(vddTopology.localPins.length).toBe(2); // pin A1 + TP101
    expect(vddTopology.classification).toBe(NetClassification.POWER_MAIN);
  });
});
