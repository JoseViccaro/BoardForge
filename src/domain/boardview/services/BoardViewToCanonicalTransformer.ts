import { BoardId } from "../../catalog/value-objects/BoardId.js";
import { SubBoardId } from "../../catalog/value-objects/SubBoardId.js";
import { BoardStackType } from "../../catalog/value-objects/BoardStackType.js";
import { CompositeBoard } from "../../catalog/aggregates/CompositeBoard.js";
import { SubBoardEntity, SubBoardRole } from "../../catalog/entities/SubBoardEntity.js";
import { PadEntity } from "../entities/PadEntity.js";
import { ComponentEntity } from "../entities/ComponentEntity.js";
import { NetTopology } from "../aggregates/NetTopology.js";
import { LayerCoordinate } from "../value-objects/LayerCoordinate.js";
import { NetClassification } from "../value-objects/NetClassification.js";
import { InterposerJunction } from "../value-objects/InterposerJunction.js";
import { RawBoardViewDocument } from "../intermediate/RawBoardViewDocument.js";

export interface TransformSingleBoardRequest {
  boardId: BoardId | string;
  subBoardId: SubBoardId | string;
  subBoardLabel?: string;
  subBoardRole?: SubBoardRole;
  document: RawBoardViewDocument;
}

export interface InterposerMappingRule {
  junctionId: string;
  interposerPadId: string;
  topComponentRef?: string;
  topPinRef?: string;
  bottomComponentRef?: string;
  bottomPinRef?: string;
  netName: string;
  classification?: NetClassification;
}

export interface TransformSandwichRequest {
  boardId: BoardId | string;
  topSubBoardId: SubBoardId | string;
  topSubBoardLabel?: string;
  topDocument: RawBoardViewDocument;
  bottomSubBoardId: SubBoardId | string;
  bottomSubBoardLabel?: string;
  bottomDocument: RawBoardViewDocument;
  interposerMappings?: InterposerMappingRule[];
}

export interface SingleBoardCanonicalResult {
  compositeBoard: CompositeBoard;
  subBoard: SubBoardEntity;
  netTopologies: Map<string, NetTopology>;
}

export interface SandwichCanonicalResult {
  compositeBoard: CompositeBoard;
  topSubBoard: SubBoardEntity;
  bottomSubBoard: SubBoardEntity;
  netTopologies: Map<string, NetTopology>;
}

export class BoardViewToCanonicalTransformer {
  public transformSingleBoard(req: TransformSingleBoardRequest): SingleBoardCanonicalResult {
    const boardId = req.boardId instanceof BoardId ? req.boardId : new BoardId(req.boardId);
    const subBoardId = req.subBoardId instanceof SubBoardId ? req.subBoardId : new SubBoardId(req.subBoardId);
    const label = req.subBoardLabel || req.document.name || "Main Board";
    const role = req.subBoardRole || SubBoardRole.TOP_LOGIC;

    const { subBoard, pinNetMap } = this.convertRawDocToSubBoard(subBoardId, label, role, req.document);

    const netTopologies = new Map<string, NetTopology>();
    for (const [netName, bindings] of pinNetMap.entries()) {
      if (netName === "UNCONNECTED" || !netName) continue;
      const classification = this.classifyNet(netName);
      const topology = new NetTopology({
        id: `NET_${boardId.value}_${netName}`,
        canonicalNetName: netName,
        classification,
        localPins: bindings.map(b => ({
          subBoardId: subBoardId.value,
          padId: b.padId,
          pinRef: b.pinRef
        }))
      });
      netTopologies.set(netName, topology);
    }

    const compositeBoard = new CompositeBoard({
      id: boardId,
      boardNumber: boardId.value,
      stackType: BoardStackType.SINGLE_LAYER,
      subBoards: [subBoard]
    });

    return {
      compositeBoard,
      subBoard,
      netTopologies
    };
  }

  public transformSandwich(req: TransformSandwichRequest): SandwichCanonicalResult {
    const boardId = req.boardId instanceof BoardId ? req.boardId : new BoardId(req.boardId);
    const topSubBoardId = req.topSubBoardId instanceof SubBoardId ? req.topSubBoardId : new SubBoardId(req.topSubBoardId);
    const bottomSubBoardId = req.bottomSubBoardId instanceof SubBoardId ? req.bottomSubBoardId : new SubBoardId(req.bottomSubBoardId);

    const topLabel = req.topSubBoardLabel || req.topDocument.name || "Top Logic";
    const bottomLabel = req.bottomSubBoardLabel || req.bottomDocument.name || "Bottom RF";

    const topConverted = this.convertRawDocToSubBoard(topSubBoardId, topLabel, SubBoardRole.TOP_LOGIC, req.topDocument);
    const bottomConverted = this.convertRawDocToSubBoard(bottomSubBoardId, bottomLabel, SubBoardRole.BOTTOM_RF, req.bottomDocument);

    const compositeBoard = new CompositeBoard({
      id: boardId,
      boardNumber: boardId.value,
      stackType: BoardStackType.SANDWICH_INTERPOSER,
      subBoards: [topConverted.subBoard, bottomConverted.subBoard]
    });

    const netTopologies = new Map<string, NetTopology>();

    // Collect all unique net names across top and bottom
    const allNetNames = new Set<string>();
    for (const n of topConverted.pinNetMap.keys()) if (n !== "UNCONNECTED") allNetNames.add(n);
    for (const n of bottomConverted.pinNetMap.keys()) if (n !== "UNCONNECTED") allNetNames.add(n);
    if (req.interposerMappings) {
      for (const m of req.interposerMappings) allNetNames.add(m.netName);
    }

    for (const netName of allNetNames) {
      const classification = this.classifyNet(netName);
      const topBindings = (topConverted.pinNetMap.get(netName) || []).map(b => ({
        subBoardId: topSubBoardId.value,
        padId: b.padId,
        pinRef: b.pinRef
      }));
      const bottomBindings = (bottomConverted.pinNetMap.get(netName) || []).map(b => ({
        subBoardId: bottomSubBoardId.value,
        padId: b.padId,
        pinRef: b.pinRef
      }));

      const junctions: InterposerJunction[] = [];
      if (req.interposerMappings) {
        const mappingsForNet = req.interposerMappings.filter(m => m.netName === netName);
        for (const mapRule of mappingsForNet) {
          const topPad = topConverted.subBoard.pads.find(p =>
            (mapRule.topComponentRef && p.componentId?.includes(mapRule.topComponentRef) && p.pinName === mapRule.topPinRef) ||
            p.padNumber === mapRule.interposerPadId || p.id.includes(mapRule.interposerPadId)
          );
          const botPad = bottomConverted.subBoard.pads.find(p =>
            (mapRule.bottomComponentRef && p.componentId?.includes(mapRule.bottomComponentRef) && p.pinName === mapRule.bottomPinRef) ||
            p.padNumber === mapRule.interposerPadId || p.id.includes(mapRule.interposerPadId)
          );

          junctions.push(new InterposerJunction({
            junctionId: mapRule.junctionId,
            interposerPadId: mapRule.interposerPadId,
            topPadId: topPad ? topPad.id : null,
            bottomPadId: botPad ? botPad.id : null,
            canonicalNetName: netName,
            classification: mapRule.classification || classification
          }));
        }
      }

      const topology = new NetTopology({
        id: `NET_${boardId.value}_${netName}`,
        canonicalNetName: netName,
        classification,
        localPins: [...topBindings, ...bottomBindings],
        interposerJunctions: junctions
      });

      netTopologies.set(netName, topology);
    }

    return {
      compositeBoard,
      topSubBoard: topConverted.subBoard,
      bottomSubBoard: bottomConverted.subBoard,
      netTopologies
    };
  }

  private convertRawDocToSubBoard(
    subBoardId: SubBoardId,
    label: string,
    role: SubBoardRole,
    doc: RawBoardViewDocument
  ): { subBoard: SubBoardEntity; pinNetMap: Map<string, { padId: string; pinRef: string }[]> } {
    const pads: PadEntity[] = [];
    const components: ComponentEntity[] = [];
    const pinNetMap = new Map<string, { padId: string; pinRef: string }[]>();

    // Process components and pins
    for (const rawComp of doc.components) {
      const compId = `COMP_${subBoardId.value}_${rawComp.refDes}`;
      const compPins: PadEntity[] = [];

      for (const rawPin of rawComp.pins) {
        const padId = `PAD_${subBoardId.value}_${rawComp.refDes}_${rawPin.pinRef}`;
        const padCoord = new LayerCoordinate(rawPin.x, rawPin.y, rawPin.side, 0);

        const isInterposer = rawComp.refDes.toUpperCase().includes("INTERPOSER");
        const pad = new PadEntity({
          id: padId,
          padNumber: rawPin.pinRef,
          subBoardId,
          coordinate: padCoord,
          netName: rawPin.netName,
          componentId: compId,
          pinName: rawPin.pinRef,
          isInterposerPad: isInterposer
        });

        pads.push(pad);
        compPins.push(pad);

        if (rawPin.netName) {
          const list = pinNetMap.get(rawPin.netName) || [];
          list.push({ padId, pinRef: `${rawComp.refDes}.${rawPin.pinRef}` });
          pinNetMap.set(rawPin.netName, list);
        }
      }

      const comp = new ComponentEntity({
        id: compId,
        designator: rawComp.refDes,
        subBoardId,
        coordinate: new LayerCoordinate(rawComp.x, rawComp.y, rawComp.side, 0),
        packageType: rawComp.package || null,
        pins: compPins
      });

      components.push(comp);
    }

    // Process Nails / Test points as pads
    for (const rawNail of doc.nails) {
      const nailPadId = `PAD_${subBoardId.value}_${rawNail.id}`;
      const nailCoord = new LayerCoordinate(rawNail.x, rawNail.y, rawNail.side, 0);
      const pad = new PadEntity({
        id: nailPadId,
        padNumber: rawNail.id,
        subBoardId,
        coordinate: nailCoord,
        netName: rawNail.netName,
        componentId: null,
        pinName: rawNail.id,
        isInterposerPad: false
      });

      pads.push(pad);

      if (rawNail.netName) {
        const list = pinNetMap.get(rawNail.netName) || [];
        list.push({ padId: nailPadId, pinRef: rawNail.id });
        pinNetMap.set(rawNail.netName, list);
      }
    }

    const subBoard = new SubBoardEntity({
      id: subBoardId,
      label,
      role,
      layerCount: 2,
      dimensions: {
        width: doc.outline.width || 100,
        height: doc.outline.height || 50
      },
      pads,
      components
    });

    return { subBoard, pinNetMap };
  }

  private classifyNet(netName: string): NetClassification {
    const upper = netName.toUpperCase();
    if (upper === "GND" || upper === "GROUND" || upper.startsWith("GND_")) {
      return NetClassification.GROUND;
    }
    if (upper.startsWith("PP_VDD_MAIN") || upper.startsWith("PP_BATT") || upper.startsWith("PP_VCC") || upper.startsWith("PP_SYS")) {
      return NetClassification.POWER_MAIN;
    }
    if (upper.includes("BUCK") || upper.includes("LDO") || upper.startsWith("PP_1V") || upper.startsWith("PP_0V") || upper.startsWith("PP_3V") || upper.startsWith("PP_5V")) {
      return NetClassification.POWER_BUCK;
    }
    if (upper.includes("I2C") || upper.includes("SDA") || upper.includes("SCL")) {
      return NetClassification.SIGNAL_I2C;
    }
    if (upper.includes("SPI") || upper.includes("MISO") || upper.includes("MOSI") || upper.includes("CLK") || upper.includes("CS")) {
      return NetClassification.SIGNAL_SPI;
    }
    if (upper.includes("ANT") || upper.includes("RF_") || upper.includes("CELL") || upper.includes("WIFI")) {
      return NetClassification.RF_ANTENNA;
    }
    return NetClassification.POWER_MAIN;
  }
}
