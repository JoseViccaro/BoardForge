import { describe, it, expect } from "vitest";
import { SchematicDocument } from "../../../../src/domain/schematics/aggregates/SchematicDocument.js";
import { SchematicSheet } from "../../../../src/domain/schematics/entities/SchematicSheet.js";
import { SchematicSymbol } from "../../../../src/domain/schematics/entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../../../../src/domain/schematics/entities/SchematicPinLocation.js";
import { SchematicNet } from "../../../../src/domain/schematics/entities/SchematicNet.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { VectorToken } from "../../../../src/domain/schematics/value-objects/VectorToken.js";

describe("SchematicDocument Aggregate & Domain Entities", () => {
  describe("SchematicDocument initialization and validation", () => {
    it("should create a valid SchematicDocument", () => {
      const doc = new SchematicDocument({
        documentId: "DOC_IPHONE13",
        title: "iPhone 13 Logic Board Schematic",
        pageCount: 3,
      });

      expect(doc.documentId).toBe("DOC_IPHONE13");
      expect(doc.title).toBe("iPhone 13 Logic Board Schematic");
      expect(doc.pageCount).toBe(3);
      expect(doc.sheetCount).toBe(3);
    });

    it("should throw for invalid document properties", () => {
      expect(() => new SchematicDocument({ documentId: "", title: "Doc", pageCount: 1 })).toThrow("documentId cannot be empty");
      expect(() => new SchematicDocument({ documentId: "ID", title: "", pageCount: 1 })).toThrow("title cannot be empty");
      expect(() => new SchematicDocument({ documentId: "ID", title: "Doc", pageCount: 0 })).toThrow("pageCount must be a positive integer");
    });
  });

  describe("SchematicSheet & SchematicNet management", () => {
    it("should add and retrieve sheets", () => {
      const doc = new SchematicDocument({
        documentId: "DOC_01",
        title: "Multi-sheet Doc",
        pageCount: 2,
      });

      const sheet1 = new SchematicSheet({
        sheetNumber: 1,
        width: 1920,
        height: 1080,
      });

      const sheet2 = new SchematicSheet({
        sheetNumber: 2,
        width: 1920,
        height: 1080,
      });

      sheet1.addToken(new VectorToken({
        text: "PP_VDD_MAIN",
        pageNumber: 1,
        bounds: new BoundingBox2D(10, 20, 100, 40),
        fontSize: 12,
        fontFamily: "Helvetica",
      }));

      doc.addSheet(sheet1);
      doc.addSheet(sheet2);

      expect(doc.sheets.size).toBe(2);
      expect(doc.getSheet(1)).toBe(sheet1);
      expect(doc.getSheet(2)).toBe(sheet2);
      expect(doc.getSheet(3)).toBeUndefined();
      expect(doc.pages.size).toBe(2);
      expect(doc.getPage(1)).toBe(sheet1);

      const tokens = doc.searchTokens("PP_VDD");
      expect(tokens).toHaveLength(1);
      expect(tokens[0].text).toBe("PP_VDD_MAIN");
    });

    it("should manage SchematicNet entities", () => {
      const net = new SchematicNet({
        id: "NET_PP_VDD_MAIN",
        name: "PP_VDD_MAIN",
        sheetNumbers: [1, 2],
      });

      expect(net.id).toBe("NET_PP_VDD_MAIN");
      expect(net.name).toBe("PP_VDD_MAIN");
      expect(net.sheetNumbers).toEqual([1, 2]);

      const doc = new SchematicDocument({
        documentId: "DOC_01",
        title: "Net Doc",
        pageCount: 2,
      });

      doc.addNet(net);
      expect(doc.nets.size).toBe(1);
      expect(doc.getNet("PP_VDD_MAIN")).toBe(net);
      expect(doc.getNet("pp_vdd_main")).toBe(net);
    });
  });

  describe("SchematicSymbol and duplicate RefDes disambiguation", () => {
    it("should aggregate split multi-unit IC symbols under parent RefDes", () => {
      const doc = new SchematicDocument({
        documentId: "DOC_01",
        title: "Split IC Doc",
        pageCount: 2,
      });

      const symBankA = new SchematicSymbol({
        id: "SYM_U2700_A",
        refDes: "U2700_A",
        bankDesignator: "A",
        pageNumber: 1,
        bounds: new BoundingBox2D(100, 100, 200, 200),
        value: "PMIC_A15",
        packageFootprint: "BGA-120",
        pins: [
          new SchematicPinLocation({
            id: "PIN_U2700_A1",
            refDes: "U2700",
            pinNumber: "A1",
            pinName: "VIN",
            pageNumber: 1,
            bounds: new BoundingBox2D(105, 105, 115, 115),
            connectionPoint: { x: 105, y: 110 },
            connectedNetName: "PP_BATT_VCC",
          }),
          new SchematicPinLocation({
            id: "PIN_U2700_A2",
            refDes: "U2700",
            pinNumber: "A2",
            pinName: "VOUT",
            pageNumber: 1,
            bounds: new BoundingBox2D(105, 120, 115, 130),
            connectionPoint: { x: 105, y: 125 },
            connectedNetName: "PP_VDD_MAIN",
          }),
        ],
      });

      const symBankB = new SchematicSymbol({
        id: "SYM_U2700_B",
        refDes: "U2700_B",
        bankDesignator: "B",
        pageNumber: 2,
        bounds: new BoundingBox2D(300, 300, 400, 400),
        value: "PMIC_A15",
        packageFootprint: "BGA-120",
        pins: [
          new SchematicPinLocation({
            id: "PIN_U2700_B1",
            refDes: "U2700",
            pinNumber: "B1",
            pinName: "GPIO1",
            pageNumber: 2,
            bounds: new BoundingBox2D(305, 305, 315, 315),
            connectionPoint: { x: 305, y: 310 },
            connectedNetName: "PMU_TO_SOC_IRQ",
          }),
          new SchematicPinLocation({
            id: "PIN_U2700_B2",
            refDes: "U2700",
            pinNumber: "B2",
            pinName: "GND",
            pageNumber: 2,
            bounds: new BoundingBox2D(305, 320, 315, 330),
            connectionPoint: { x: 305, y: 325 },
            connectedNetName: "GND",
          }),
        ],
      });

      expect(symBankA.value).toBe("PMIC_A15");
      expect(symBankA.packageFootprint).toBe("BGA-120");

      doc.registerSymbol(symBankA);
      doc.registerSymbol(symBankB);

      const multiPageSymbol = doc.getSymbol("U2700");
      expect(multiPageSymbol).toBeDefined();
      expect(multiPageSymbol!.refDes).toBe("U2700");
      expect(multiPageSymbol!.symbols).toHaveLength(2);
      expect(multiPageSymbol!.getAllPages()).toEqual([1, 2]);

      const allPins = doc.findPinsForRefDes("U2700");
      expect(allPins).toHaveLength(4);
      expect(allPins.map((p) => p.pinNumber)).toEqual(["A1", "A2", "B1", "B2"]);

      const pinA1 = multiPageSymbol!.findPin("A1");
      expect(pinA1).toBeDefined();
      expect(pinA1?.pin.connectedNetName).toBe("PP_BATT_VCC");
      expect(pinA1?.symbol.pageNumber).toBe(1);

      const pinB1 = multiPageSymbol!.findPin("B1");
      expect(pinB1).toBeDefined();
      expect(pinB1?.pin.connectedNetName).toBe("PMU_TO_SOC_IRQ");
      expect(pinB1?.symbol.pageNumber).toBe(2);
    });
  });
});
