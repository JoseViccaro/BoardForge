import { describe, it, expect, beforeEach } from "vitest";
import { SymbolExtractorService } from "../../../../src/domain/schematics/services/SymbolExtractorService.js";
import { SchematicPage } from "../../../../src/domain/schematics/entities/SchematicPage.js";
import { VectorToken, TokenType } from "../../../../src/domain/schematics/value-objects/VectorToken.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";

describe("SymbolExtractorService Regex & Spatial Association Engine", () => {
  let service: SymbolExtractorService;

  beforeEach(() => {
    service = new SymbolExtractorService();
  });

  describe("Regex Classifiers", () => {
    it("should classify IC designators", () => {
      expect(service.isDesignator("U2700")).toBe(true);
      expect(service.isDesignator("U_BB_PMU")).toBe(true);
      expect(service.isDesignator("PMU_A15")).toBe(true);
      expect(service.isDesignator("PMX60")).toBe(true);
      expect(service.isDesignator("U3300A")).toBe(true);
      expect(service.isDesignator("NOT_A_DESIG")).toBe(false);
    });

    it("should classify discrete passive designators", () => {
      expect(service.isDesignator("R1201")).toBe(true);
      expect(service.isDesignator("C5001")).toBe(true);
      expect(service.isDesignator("L1000")).toBe(true);
      expect(service.isDesignator("D201")).toBe(true);
      expect(service.isDesignator("Q3100")).toBe(true);
      expect(service.isDesignator("FL4001")).toBe(true);
      expect(service.isDesignator("TP101")).toBe(true);
      expect(service.isDesignator("J5700")).toBe(true);
    });

    it("should classify pin numbers (BGA and leads)", () => {
      expect(service.isPinNumber("A12")).toBe(true);
      expect(service.isPinNumber("B1")).toBe(true);
      expect(service.isPinNumber("AH35")).toBe(true);
      expect(service.isPinNumber("1")).toBe(true);
      expect(service.isPinNumber("144")).toBe(true);
      expect(service.isPinNumber("PP_VDD_MAIN")).toBe(false);
    });

    it("should classify microelectronics net labels", () => {
      expect(service.isNetLabel("PP_VDD_MAIN")).toBe(true);
      expect(service.isNetLabel("PP1V8_S2")).toBe(true);
      expect(service.isNetLabel("PP_VDD_CPU_CORE")).toBe(true);
      expect(service.isNetLabel("BUTTON_TO_PMU_ONOFF_L")).toBe(true);
      expect(service.isNetLabel("AP_TO_PMU_RESET_N")).toBe(true);
      expect(service.isNetLabel("I2C0_SDA")).toBe(true);
      expect(service.isNetLabel("SPI1_CLK")).toBe(true);
      expect(service.isNetLabel("UART0_TXD")).toBe(true);
      expect(service.isNetLabel("RANDOM_TEXT")).toBe(false);
    });
  });

  describe("Page Extraction & Association", () => {
    it("should extract symbols, pins, and net labels from page tokens", () => {
      const page = new SchematicPage({ pageNumber: 12, width: 1000, height: 800 });

      // Add tokens
      page.addToken(new VectorToken({
        text: "U2700",
        pageNumber: 12,
        bounds: new BoundingBox2D(100, 100, 150, 120),
        fontSize: 14,
      }));

      // Pins near symbol
      page.addToken(new VectorToken({
        text: "A12",
        pageNumber: 12,
        bounds: new BoundingBox2D(110, 130, 130, 140),
        fontSize: 8,
      }));

      // Net label near pin A12
      page.addToken(new VectorToken({
        text: "PP_VDD_MAIN",
        pageNumber: 12,
        bounds: new BoundingBox2D(140, 130, 220, 140),
        fontSize: 8,
      }));

      const extractionResult = service.extractPageEntities(page);

      expect(extractionResult.symbols).toHaveLength(1);
      const sym = extractionResult.symbols[0];
      expect(sym.refDes).toBe("U2700");
      expect(sym.pins).toHaveLength(1);
      expect(sym.pins[0].pinNumber).toBe("A12");
      expect(sym.pins[0].connectedNetName).toBe("PP_VDD_MAIN");

      expect(extractionResult.netLabels).toHaveLength(1);
      expect(extractionResult.netLabels[0].netName).toBe("PP_VDD_MAIN");
    });
  });
});
