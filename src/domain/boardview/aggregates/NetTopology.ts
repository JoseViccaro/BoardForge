import { InterposerJunction } from "../value-objects/InterposerJunction.js";
import { NetClassification } from "../value-objects/NetClassification.js";

export interface SubBoardPinBinding {
  subBoardId: string;
  padId: string;
  pinRef?: string;
}

export interface NetTopologyProps {
  id: string;
  canonicalNetName: string;
  classification: NetClassification;
  localPins?: SubBoardPinBinding[];
  interposerJunctions?: InterposerJunction[];
}

export class NetTopology {
  public readonly id: string;
  public readonly canonicalNetName: string;
  public readonly classification: NetClassification;
  private readonly _localPins: SubBoardPinBinding[];
  private readonly _interposerJunctions: InterposerJunction[];

  // Fast O(1) index lookup caches
  private readonly _padToJunction: Map<string, InterposerJunction> = new Map();
  private readonly _padToPinBinding: Map<string, SubBoardPinBinding> = new Map();
  private readonly _interposerPadToJunction: Map<string, InterposerJunction> = new Map();

  constructor(props: NetTopologyProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("id cannot be empty");
    }
    if (!props.canonicalNetName || props.canonicalNetName.trim().length === 0) {
      throw new Error("canonicalNetName cannot be empty");
    }
    if (!props.classification) {
      throw new Error("classification is required");
    }

    this.id = props.id.trim();
    this.canonicalNetName = props.canonicalNetName.trim();
    this.classification = props.classification;
    this._localPins = [];
    this._interposerJunctions = [];

    if (props.localPins) {
      for (const pin of props.localPins) {
        this.addPinBinding(pin.subBoardId, pin.padId, pin.pinRef);
      }
    }

    if (props.interposerJunctions) {
      for (const junc of props.interposerJunctions) {
        this.addInterposerJunction(junc);
      }
    }
  }

  public get localPins(): ReadonlyArray<SubBoardPinBinding> {
    return Object.freeze([...this._localPins]);
  }

  public get interposerJunctions(): ReadonlyArray<InterposerJunction> {
    return Object.freeze([...this._interposerJunctions]);
  }

  public addPinBinding(subBoardId: string, padId: string, pinRef?: string): void {
    const binding: SubBoardPinBinding = {
      subBoardId: subBoardId.trim(),
      padId: padId.trim(),
      pinRef: pinRef ? pinRef.trim() : undefined,
    };
    this._localPins.push(binding);
    this._padToPinBinding.set(binding.padId, binding);
  }

  public addInterposerJunction(junction: InterposerJunction): void {
    this._interposerJunctions.push(junction);
    this._interposerPadToJunction.set(junction.interposerPadId, junction);

    if (junction.interposerPadId) {
      this._padToJunction.set(junction.interposerPadId, junction);
    }
    if (junction.topPadId) {
      this._padToJunction.set(junction.topPadId, junction);
    }
    if (junction.bottomPadId) {
      this._padToJunction.set(junction.bottomPadId, junction);
    }
  }

  public getJunctionForPad(padId: string): InterposerJunction | undefined {
    return this._padToJunction.get(padId);
  }

  public resolveConnectedPins(
    fromSubBoardId: string,
    fromPadId: string
  ): SubBoardPinBinding[] {
    const junction = this.getJunctionForPad(fromPadId);
    if (!junction) {
      return this._localPins.filter(
        (p) => p.padId !== fromPadId && p.subBoardId === fromSubBoardId
      );
    }

    // Connected across junction
    const targetPads: string[] = [];
    if (junction.topPadId && junction.topPadId !== fromPadId) {
      targetPads.push(junction.topPadId);
    }
    if (junction.bottomPadId && junction.bottomPadId !== fromPadId) {
      targetPads.push(junction.bottomPadId);
    }

    return this._localPins.filter(
      (p) => p.padId !== fromPadId && (targetPads.includes(p.padId) || p.subBoardId !== fromSubBoardId)
    );
  }

  public resolveFromInterposerPad(interposerPadId: string):
    | {
        canonicalNetName: string;
        classification: NetClassification;
        connectedPads: SubBoardPinBinding[];
      }
    | undefined {
    const junction = this._interposerPadToJunction.get(interposerPadId);
    if (!junction) {
      return undefined;
    }

    const connectedPadIds = new Set<string>();
    if (junction.topPadId) connectedPadIds.add(junction.topPadId);
    if (junction.bottomPadId) connectedPadIds.add(junction.bottomPadId);

    const connectedPads = this._localPins.filter((p) =>
      connectedPadIds.has(p.padId)
    );

    return {
      canonicalNetName: this.canonicalNetName,
      classification: this.classification,
      connectedPads,
    };
  }
}
