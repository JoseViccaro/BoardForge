import { SchematicPage } from "../entities/SchematicPage.js";
import { SchematicSymbol } from "../entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../entities/SchematicPinLocation.js";
import { NetLabelMatch } from "../value-objects/NetLabelMatch.js";
import { VectorToken, TokenType } from "../value-objects/VectorToken.js";
import { BoundingBox2D } from "../value-objects/BoundingBox2D.js";

export interface ExtractionResult {
  symbols: SchematicSymbol[];
  netLabels: NetLabelMatch[];
}

export class SymbolExtractorService {
  private readonly icRegex = /^(U[0-9]{1,5}[A-Z]?|U_[A-Z0-9_]+|PMU_[A-Z0-9_]+|PMX[0-9]{2,3})$/i;
  private readonly passiveRegex = /^([RCLDQ]|FL|TP|J)[0-9]{1,5}$/i;
  private readonly bgaPinRegex = /^[A-HJ-NP-Z]{1,2}[0-9]{1,3}$/i;
  private readonly numPinRegex = /^[0-9]{1,4}$/;
  private readonly powerRailRegex = /^PP[0-9A-Z_]+$/i;
  private readonly activeLowRegex = /^[A-Z0-9_]+_[LN]$/i;
  private readonly busRegex = /^(I2C|SPI|UART|RFFE|MIPI)[0-9]_[A-Z0-9_]+$/i;

  public isDesignator(text: string): boolean {
    const trimmed = text.trim();
    return this.icRegex.test(trimmed) || this.passiveRegex.test(trimmed);
  }

  public isPinNumber(text: string): boolean {
    const trimmed = text.trim();
    if (this.powerRailRegex.test(trimmed) || this.activeLowRegex.test(trimmed) || this.busRegex.test(trimmed)) {
      return false;
    }
    return this.bgaPinRegex.test(trimmed) || this.numPinRegex.test(trimmed);
  }

  public isNetLabel(text: string): boolean {
    const trimmed = text.trim();
    return this.powerRailRegex.test(trimmed) || this.activeLowRegex.test(trimmed) || this.busRegex.test(trimmed);
  }

  public extractPageEntities(page: SchematicPage): ExtractionResult {
    const tokens = page.tokens;
    const designatorTokens: VectorToken[] = [];
    const pinTokens: VectorToken[] = [];
    const netTokens: VectorToken[] = [];

    for (const token of tokens) {
      if (this.isDesignator(token.text)) {
        designatorTokens.push(token);
      } else if (this.isNetLabel(token.text)) {
        netTokens.push(token);
      } else if (this.isPinNumber(token.text)) {
        pinTokens.push(token);
      }
    }

    const netLabels: NetLabelMatch[] = netTokens.map((t) => new NetLabelMatch({
      netName: t.text,
      pageNumber: page.pageNumber,
      bounds: t.bounds,
      rotation: t.rotation,
    }));

    const symbols: SchematicSymbol[] = [];

    for (const desig of designatorTokens) {
      // Create envelope around designator (e.g. radius 150)
      const symbolEnvelope = desig.bounds.expand(100);
      const sym = new SchematicSymbol({
        id: `SYM_${desig.text}_P${page.pageNumber}`,
        refDes: desig.text,
        pageNumber: page.pageNumber,
        bounds: symbolEnvelope,
      });

      // Find nearby pins
      for (const pToken of pinTokens) {
        if (symbolEnvelope.intersects(pToken.bounds)) {
          // Find nearest net label to pin
          let connectedNet: string | undefined = undefined;
          let minNetDist = 120;

          for (const nLabel of netLabels) {
            const dx = nLabel.bounds.center.x - pToken.bounds.center.x;
            const dy = nLabel.bounds.center.y - pToken.bounds.center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minNetDist) {
              minNetDist = dist;
              connectedNet = nLabel.netName;
            }
          }

          const pin = new SchematicPinLocation({
            id: `PIN_${desig.text}_${pToken.text}_P${page.pageNumber}`,
            refDes: desig.text,
            pinNumber: pToken.text,
            pageNumber: page.pageNumber,
            bounds: pToken.bounds,
            connectionPoint: { x: pToken.bounds.center.x, y: pToken.bounds.center.y },
            connectedNetName: connectedNet,
          });

          sym.addPin(pin);
        }
      }

      symbols.push(sym);
    }

    return {
      symbols,
      netLabels,
    };
  }
}
