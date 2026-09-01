import { describe, it, expect, beforeEach } from "vitest";
import { SchematicCrossProbeIndex } from "../../../../src/application/schematics/services/SchematicCrossProbeIndex.js";
import { SchematicDocument } from "../../../../src/domain/schematics/aggregates/SchematicDocument.js";
import { SchematicSheet } from "../../../../src/domain/schematics/entities/SchematicSheet.js";
import { SchematicSymbol } from "../../../../src/domain/schematics/entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../../../../src/domain/schematics/entities/SchematicPinLocation.js";
import { NetLabelMatch } from "../../../../src/domain/schematics/value-objects/NetLabelMatch.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { VectorToken, TokenType } from "../../../../src/domain/schematics/value-objects/VectorToken.js";
import { NetTopology } from "../../../../src/domain/boardview/aggregates/NetTopology.js";
import { NetClassification } from "../../../../src/domain/boardview/value-objects/NetClassification.js";
import { SubBoardEntity, SubBoardRole } from "../../../../src/domain/catalog/entities/SubBoardEntity.js";
import { PadEntity } from "../../../../src/domain/boardview/entities/PadEntity.js";
import { LayerCoordinate } from "../../../../src/domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";
import { performance } from "node:perf_hooks";

describe("SchematicCrossProbeIndex Application Service & Latency Budget", () => {
  let index: SchematicCrossProbeIndex;
  let doc: SchematicDocument;

  beforeEach(() => {
    index = new SchematicCrossProbeIndex();
    doc = new SchematicDocument({
      documentId: "DOC_TEST_IPHONE",
      title: "iPhone Schematic",
      pageCount: 50,
    });

    for (let pageNum = 1; pageNum <= 50; pageNum++) {
      const sheet = new SchematicSheet({ sheetNumber: pageNum, width: 1920, height: 1080 });
      for (let i = 1; i <= 20; i++) {
        const refDes = `U${pageNum * 100 + i}`;
        const sym = new SchematicSymbol({
          id: `SYM_${refDes}`,
          refDes,
          pageNumber: pageNum,
          bounds: new BoundingBox2D(100, 100, 300, 300),
          pins: [
            new SchematicPinLocation({
              id: `PIN_${refDes}_1`,
              refDes,
              pinNumber: "1",
              pageNumber: pageNum,
              bounds: new BoundingBox2D(110, 110, 120, 120),
              connectionPoint: { x: 115, y: 115 },
              connectedNetName: `NET_${pageNum}_${i}`,
            }),
          ],
        });
        sheet.addSymbol(sym);
        sheet.addNetLabel(new NetLabelMatch({
          netName: `NET_${pageNum}_${i}`,
          pageNumber: pageNum,
          bounds: new BoundingBox2D(150, 150, 250, 165),
        }));
        sheet.addToken(new VectorToken({
          text: `NET_${pageNum}_${i}`,
          pageNumber: pageNum,
          bounds: new BoundingBox2D(150, 150, 250, 165),
          fontSize: 10,
          tokenType: TokenType.NET_LABEL,
        }));
      }
      doc.addSheet(sheet);
    }

    index.registerSchematicDocument(doc);
  });

  it("should query from BoardView pin in sub-millisecond latency (< 1ms)", () => {
    const start = performance.now();
    const hits = index.queryFromBoardViewPin("U2505", "1");
    const duration = performance.now() - start;

    expect(hits).toHaveLength(1);
    expect(hits[0].refDes).toBe("U2505");
    expect(hits[0].pinNumber).toBe("1");
    expect(duration).toBeLessThan(1.0); // Strict sub-millisecond SLA
  });

  it("should query from BoardView net in sub-millisecond latency (< 1ms)", () => {
    const start = performance.now();
    const matches = index.queryFromBoardViewNet("NET_25_5");
    const duration = performance.now() - start;

    expect(matches).toHaveLength(1);
    expect(matches[0].netName).toBe("NET_25_5");
    expect(duration).toBeLessThan(1.0); // Strict sub-millisecond SLA
  });

  it("should return empty array for non-existent pin/net without throwing within < 1ms", () => {
    const start = performance.now();
    const pinHits = index.queryFromBoardViewPin("NON_EXISTENT", "99");
    const netHits = index.queryFromBoardViewNet("TP_DEBUG_UNROUTED");
    const duration = performance.now() - start;

    expect(pinHits).toEqual([]);
    expect(netHits).toEqual([]);
    expect(duration).toBeLessThan(1.0);
  });
});
