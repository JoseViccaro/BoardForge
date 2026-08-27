import { LayerCoordinate } from "../value-objects/LayerCoordinate.js";
import { SubBoardId } from "../../catalog/value-objects/SubBoardId.js";

export interface PadEntityProps {
  id: string;
  padNumber: string;
  subBoardId: SubBoardId | string;
  coordinate: LayerCoordinate;
  netName?: string | null;
  componentId?: string | null;
  pinName?: string | null;
  isInterposerPad?: boolean;
}

export class PadEntity {
  public readonly id: string;
  public readonly padNumber: string;
  public readonly subBoardId: SubBoardId;
  public readonly coordinate: LayerCoordinate;
  public readonly netName: string | null;
  public readonly componentId: string | null;
  public readonly pinName: string | null;
  public readonly isInterposerPad: boolean;

  constructor(props: PadEntityProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("id cannot be empty");
    }
    if (!props.padNumber || props.padNumber.trim().length === 0) {
      throw new Error("padNumber cannot be empty");
    }
    if (!props.coordinate) {
      throw new Error("coordinate is required");
    }

    this.id = props.id.trim();
    this.padNumber = props.padNumber.trim();
    this.subBoardId =
      props.subBoardId instanceof SubBoardId
        ? props.subBoardId
        : new SubBoardId(props.subBoardId);
    this.coordinate = props.coordinate;
    this.netName = props.netName ? props.netName.trim() : null;
    this.componentId = props.componentId ? props.componentId.trim() : null;
    this.pinName = props.pinName ? props.pinName.trim() : null;
    this.isInterposerPad = Boolean(props.isInterposerPad);
  }
}
