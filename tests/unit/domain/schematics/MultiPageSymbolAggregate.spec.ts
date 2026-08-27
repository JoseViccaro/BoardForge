import { describe, it, expect, beforeEach } from "vitest";
import { MultiPageSymbolAggregate } from "../../../../src/domain/schematics/aggregates/MultiPageSymbolAggregate.js";
import { SchematicDocument } from "../../../../src/domain/schematics/aggregates/SchematicDocument.js";
import { SchematicSymbol } from "../../../../src/domain/schematics/entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../../../../src/domain/schematics/entities/SchematicPinLocation.js";
import { SchematicPage } from "../../../../src/domain/schematics/entities/SchematicPage.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { VectorToken, TokenType } from "../../../../src/domain/schematics/value-objects/VectorToken.js";

describe("MultiPageSymbolAggregate & SchematicDocument Aggregates", () => {
  describe("MultiPageSymbolAggregate", () => {
    let aggregate: MultiPageSymbolAggregate;

    beforeEach(() => {
      aggregate = new MultiPageSymbolAggregate("U2700");
    });

    it("should aggregate symbol banks across multiple pages", () => {
      const bankA = new SchematicSymbol({
        id: "SYM_U2700_A",
        refDes: "U2700",
        bankDesignator: "A",
        pageNumber: 12,
        bounds: new BoundingBox2D(100, 100, 300, 300),
      });
      bankA.addPin(new SchematicPinLocation({
        id: "PIN_A12",
        refDes: "U2700",
        pinNumber: "A12",
        pageNumber: 12,
        bounds: new BoundingBox2D(180, 200, 195, 215),
        connectionPoint: { x: 180, y: 207.5 },
      }));

      const bankB = new SchematicSymbol({
        id: "SYM_U2700_B",
        refDes: "U2700",
        bankDesignator: "B",
        pageNumber: 13,
        bounds: new BoundingBox2D(100, 100, 300, 300),
      });
      bankB.addPin(new SchematicPinLocation({
        id: "PIN_E5",
        refDes: "U2700",
        pinNumber: "E5",
        pageNumber: 13,
        bounds: new BoundingBox2D(150, 150, 165, 165),
        connectionPoint: { x: 150, y: 157.5 },
      }));

      aggregate.addSymbolBank(bankA);
      aggregate.addSymbolBank(bankB);

      expect(aggregate.refDes).toBe("U2700");
      expect(aggregate.symbols).toHaveLength(2);
      expect(aggregate.getAllPages()).toEqual([12, 13]);
      expect(aggregate.getAllPins()).toHaveLength(2);

      const foundPinA12 = aggregate.findPin("A12");
      expect(foundPinA12).toBeDefined();
      expect(foundPinA12?.pin.pageNumber).toBe(12);

      const foundPinE5 = aggregate.findPin("E5");
      expect(foundPinE5).toBeDefined();
      expect(foundPinE5?.pin.pageNumber).toBe(13);
    });

    it("should reject adding symbol bank for different refDes", () => {
      const bankWrong = new SchematicSymbol({
        id: "SYM_U3300",
        refDes: "U3300",
        pageNumber: 25,
        bounds: new BoundingBox2D(0, 0, 10, 10),
      });

      expect(() => aggregate.addSymbolBank(bankWrong)).toThrow("refDes mismatch");
    });
  });

  describe("SchematicDocument", () => {
    let doc: SchematicDocument;

    beforeEach(() => {
      doc = new SchematicDocument({
        documentId: "DOC_IPHONE13_SCHEM",
        title: "Apple iPhone 13 Schematic 820-02106",
        pageCount: 100,
      });
    });

    it("should add pages, symbols and search tokens across document", () => {
      const page12 = new SchematicPage({ pageNumber: 12, width: 1000, height: 800 });
      page12.addToken(new VectorToken({
        text: "PP_VDD_MAIN",
        pageNumber: 12,
        bounds: new BoundingBox2D(100, 100, 200, 120),
        fontSize: 10,
        tokenType: TokenType.NET_LABEL,
      }));

      const page13 = new SchematicPage({ pageNumber: 13, width: 1000, height: 800 });
      page13.addToken(new VectorToken({
        text: "BUTTON_TO_PMU_ONOFF_L",
        pageNumber: 13,
        bounds: new BoundingBox2D(150, 150, 300, 170),
        fontSize: 10,
        tokenType: TokenType.NET_LABEL,
      }));

      doc.addPage(page12);
      doc.addPage(page13);

      expect(doc.getPage(12)).toBeDefined();
      expect(doc.getPage(13)).toBeDefined();
      expect(doc.getPage(99)).toBeUndefined();

      const searchHits = doc.searchTokens("VDD_MAIN");
      expect(searchHits).toHaveLength(1);
      expect(searchHits[0].pageNumber).toBe(12);

      const caseHits = doc.searchTokens("button_to_pmu", false);
      expect(caseHits).toHaveLength(1);
      expect(caseHits[0].pageNumber).toBe(13);
    });

    it("should register multi-page symbol aggregates and locate pins", () => {
      const page12 = new SchematicPage({ pageNumber: 12, width: 1000, height: 800 });
      const symbolA = new SchematicSymbol({
        id: "SYM_U2700_A",
        refDes: "U2700",
        bankDesignator: "A",
        pageNumber: 12,
        bounds: new BoundingBox2D(100, 100, 300, 300),
      });
      symbolA.addPin(new SchematicPinLocation({
        id: "PIN_A12",
        refDes: "U2700",
        pinNumber: "A12",
        pageNumber: 12,
        bounds: new BoundingBox2D(180, 200, 195, 215),
        connectionPoint: { x: 180, y: 207.5 },
      }));

      page12.addSymbol(symbolA);
      doc.addPage(page12);
      doc.registerSymbol(symbolA);

      const symAgg = doc.getSymbol("U2700");
      expect(symAgg).toBeDefined();
      expect(symAgg?.getAllPins()).toHaveLength(1);

      const pins = doc.findPinsForRefDes("U2700");
      expect(pins).toHaveLength(1);
      expect(pins[0].pinNumber).toBe("A12");
    });
  });
});
