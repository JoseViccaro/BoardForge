import { SchematicDocument } from "../aggregates/SchematicDocument.js";
import { NetLabelMatch } from "../value-objects/NetLabelMatch.js";
import { BoundingBox2D } from "../value-objects/BoundingBox2D.js";
import { VectorToken } from "../value-objects/VectorToken.js";
import { NetTopology } from "../../boardview/aggregates/NetTopology.js";
import { SubBoardEntity } from "../../catalog/entities/SubBoardEntity.js";
import { InterposerJunction } from "../../boardview/value-objects/InterposerJunction.js";

export interface SchematicPinHit {
  documentId: string;
  pageNumber: number;
  refDes: string;
  pinNumber: string;
  pinName?: string;
  bounds: BoundingBox2D;
  connectionPoint: { x: number; y: number };
  netName?: string;
}

export interface BoardViewPadHit {
  subBoardId: string;
  padId: string;
  refDes?: string;
  pinNumber?: string;
  netName: string;
  x: number;
  y: number;
  layer: string;
}

export interface SchematicCoordinateLookupResult {
  tokens: VectorToken[];
  netName?: string;
  pinHits: BoardViewPadHit[];
  interposerJunctions: InterposerJunction[];
}

export class SchematicCrossProbeIndex {
  private documentMap = new Map<string, SchematicDocument>();
  private pinToSchematicMap = new Map<string, SchematicPinHit[]>();
  private netToSchematicMap = new Map<string, NetLabelMatch[]>();
  
  private topologies = new Map<string, NetTopology>();
  private subBoards = new Map<string, SubBoardEntity>();
  private netToBoardViewPads = new Map<string, BoardViewPadHit[]>();
  private pinToBoardViewPad = new Map<string, BoardViewPadHit>();

  public registerSchematicDocument(doc: SchematicDocument): void {
    this.documentMap.set(doc.documentId, doc);

    for (const [pageNumber, page] of doc.pages.entries()) {
      // Register symbols and pins
      for (const sym of page.symbols) {
        for (const pin of sym.pins) {
          const key = `${pin.refDes.toUpperCase()}.${pin.pinNumber.toUpperCase()}`;
          const hit: SchematicPinHit = {
            documentId: doc.documentId,
            pageNumber,
            refDes: pin.refDes,
            pinNumber: pin.pinNumber,
            pinName: pin.pinName,
            bounds: pin.bounds,
            connectionPoint: pin.connectionPoint,
            netName: pin.connectedNetName,
          };
          if (!this.pinToSchematicMap.has(key)) {
            this.pinToSchematicMap.set(key, []);
          }
          this.pinToSchematicMap.get(key)!.push(hit);
        }
      }

      // Register net labels
      for (const net of page.netLabels) {
        const key = net.netName.toUpperCase();
        if (!this.netToSchematicMap.has(key)) {
          this.netToSchematicMap.set(key, []);
        }
        this.netToSchematicMap.get(key)!.push(net);
      }
    }
  }

  public registerBoardViewTopology(topology: NetTopology, subBoards: SubBoardEntity[]): void {
    this.topologies.set(topology.canonicalNetName.toUpperCase(), topology);
    for (const sb of subBoards) {
      const sbId = typeof sb.id === "string" ? sb.id : sb.id.value;
      this.subBoards.set(sbId, sb);
    }

    const netHits: BoardViewPadHit[] = [];

    for (const pinBinding of topology.localPins) {
      const sb = this.subBoards.get(pinBinding.subBoardId);
      if (sb) {
        const pad = sb.getPad(pinBinding.padId);
        if (pad) {
          const hit: BoardViewPadHit = {
            subBoardId: pinBinding.subBoardId,
            padId: pad.id,
            refDes: pad.componentId ?? undefined,
            pinNumber: pad.padNumber,
            netName: topology.canonicalNetName,
            x: pad.coordinate.x,
            y: pad.coordinate.y,
            layer: pad.coordinate.layer,
          };
          netHits.push(hit);

          if (pad.componentId && pad.padNumber) {
            const key = `${pad.componentId.toUpperCase()}.${pad.padNumber.toUpperCase()}`;
            this.pinToBoardViewPad.set(key, hit);
          }
        }
      }
    }

    this.netToBoardViewPads.set(topology.canonicalNetName.toUpperCase(), netHits);
  }

  public queryFromBoardViewPin(refDes: string, pinNumber: string): SchematicPinHit[] {
    const key = `${refDes.trim().toUpperCase()}.${pinNumber.trim().toUpperCase()}`;
    return this.pinToSchematicMap.get(key) ?? [];
  }

  public queryFromBoardViewNet(netName: string): NetLabelMatch[] {
    const key = netName.trim().toUpperCase();
    return this.netToSchematicMap.get(key) ?? [];
  }

  public queryFromSchematicCoordinate(
    pageNumber: number,
    x: number,
    y: number
  ): SchematicCoordinateLookupResult {
    let tokens: VectorToken[] = [];
    let netName: string | undefined = undefined;

    // Search across registered documents for this page
    for (const doc of this.documentMap.values()) {
      const page = doc.getPage(pageNumber);
      if (page) {
        tokens = page.queryPoint(x, y);
        if (tokens.length === 0) {
          // try with nearby token within 15px radius
          const nearToken = page.findNearestToken(x, y, 15);
          if (nearToken) {
            tokens = [nearToken];
          }
        }

        // Check if any token or symbol on page matches a net
        for (const token of tokens) {
          const upperText = token.text.toUpperCase();
          if (this.topologies.has(upperText)) {
            netName = upperText;
            break;
          }
        }

        // If no net name found from token, search page netLabels / pins
        if (!netName) {
          for (const netLabel of page.netLabels) {
            if (netLabel.bounds.containsPoint(x, y)) {
              netName = netLabel.netName;
              break;
            }
          }
        }

        if (!netName) {
          for (const sym of page.symbols) {
            for (const pin of sym.pins) {
              if (pin.bounds.containsPoint(x, y)) {
                netName = pin.connectedNetName;
                break;
              }
            }
            if (netName) break;
          }
        }
      }
    }

    const pinHits = netName ? this.netToBoardViewPads.get(netName.toUpperCase()) ?? [] : [];
    const topology = netName ? this.topologies.get(netName.toUpperCase()) : undefined;
    const interposerJunctions = topology ? [...topology.interposerJunctions] : [];

    return {
      tokens,
      netName,
      pinHits,
      interposerJunctions,
    };
  }
}
