import { LayerCoordinate } from "../value-objects/LayerCoordinate.js";
import { SubBoardId } from "../../catalog/value-objects/SubBoardId.js";
import { PadEntity } from "./PadEntity.js";

export interface ComponentEntityProps {
  id: string;
  designator: string;
  subBoardId: SubBoardId | string;
  coordinate: LayerCoordinate;
  packageType?: string | null;
  pins?: PadEntity[];
}

export class ComponentEntity {
  public readonly id: string;
  public readonly designator: string;
  public readonly subBoardId: SubBoardId;
  public readonly coordinate: LayerCoordinate;
  public readonly packageType: string | null;
  private readonly _pins: PadEntity[];

  constructor(props: ComponentEntityProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("id cannot be empty");
    }
    if (!props.designator || props.designator.trim().length === 0) {
      throw new Error("designator cannot be empty");
    }
    if (!props.coordinate) {
      throw new Error("coordinate is required");
    }

    this.id = props.id.trim();
    this.designator = props.designator.trim();
    this.subBoardId =
      props.subBoardId instanceof SubBoardId
        ? props.subBoardId
        : new SubBoardId(props.subBoardId);
    this.coordinate = props.coordinate;
    this.packageType = props.packageType ? props.packageType.trim() : null;
    this._pins = props.pins ? [...props.pins] : [];
  }

  public get pins(): ReadonlyArray<PadEntity> {
    return Object.freeze([...this._pins]);
  }

  public addPin(pin: PadEntity): void {
    this._pins.push(pin);
  }

  public getPin(pinNumber: string): PadEntity | undefined {
    return this._pins.find((p) => p.padNumber === pinNumber || p.id === pinNumber);
  }
}
