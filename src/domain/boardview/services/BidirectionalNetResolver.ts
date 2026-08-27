import { NetTopology, SubBoardPinBinding } from "../aggregates/NetTopology.js";
import { NetClassification } from "../value-objects/NetClassification.js";

export interface NetResolutionResult {
  canonicalNetName: string;
  classification: NetClassification;
  originPadId?: string;
  interposerPadId?: string | null;
  connectedPins: SubBoardPinBinding[];
}

export class BidirectionalNetResolver {
  public resolvePath(topology: NetTopology, originPadId: string): NetResolutionResult {
    const junction = topology.getJunctionForPad(originPadId);
    const originPin = topology.localPins.find((p) => p.padId === originPadId);
    const subBoardId = originPin ? originPin.subBoardId : "";
    const connectedPins = topology.resolveConnectedPins(subBoardId, originPadId);

    return {
      canonicalNetName: topology.canonicalNetName,
      classification: topology.classification,
      originPadId,
      interposerPadId: junction ? junction.interposerPadId : null,
      connectedPins,
    };
  }

  public resolveFromInterposerPad(
    topology: NetTopology,
    interposerPadId: string
  ): NetResolutionResult | undefined {
    const interposerRes = topology.resolveFromInterposerPad(interposerPadId);
    if (!interposerRes) {
      return undefined;
    }

    return {
      canonicalNetName: interposerRes.canonicalNetName,
      classification: interposerRes.classification,
      interposerPadId,
      connectedPins: interposerRes.connectedPads,
    };
  }
}
