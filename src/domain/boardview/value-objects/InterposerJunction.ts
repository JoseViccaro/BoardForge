import { NetClassification } from "./NetClassification.js";

export interface InterposerJunctionProps {
  junctionId: string;
  interposerPadId: string;
  topPadId?: string | null;
  bottomPadId?: string | null;
  canonicalNetName: string;
  classification: NetClassification;
}

export class InterposerJunction {
  public readonly junctionId: string;
  public readonly interposerPadId: string;
  public readonly topPadId: string | null;
  public readonly bottomPadId: string | null;
  public readonly canonicalNetName: string;
  public readonly classification: NetClassification;

  constructor(props: InterposerJunctionProps) {
    if (!props.junctionId || props.junctionId.trim().length === 0) {
      throw new Error("junctionId cannot be empty");
    }
    if (!props.interposerPadId || props.interposerPadId.trim().length === 0) {
      throw new Error("interposerPadId cannot be empty");
    }
    if (!props.canonicalNetName || props.canonicalNetName.trim().length === 0) {
      throw new Error("canonicalNetName cannot be empty");
    }
    if (!props.classification) {
      throw new Error("classification is required");
    }

    this.junctionId = props.junctionId.trim();
    this.interposerPadId = props.interposerPadId.trim();
    this.topPadId = props.topPadId ? props.topPadId.trim() : null;
    this.bottomPadId = props.bottomPadId ? props.bottomPadId.trim() : null;
    this.canonicalNetName = props.canonicalNetName.trim();
    this.classification = props.classification;
  }

  public isBridge(): boolean {
    return Boolean(this.topPadId && this.bottomPadId);
  }
}
