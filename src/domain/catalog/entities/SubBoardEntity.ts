import { SubBoardId } from "../value-objects/SubBoardId.js";

export enum SubBoardRole {
  TOP_LOGIC = "TOP_LOGIC",
  BOTTOM_RF = "BOTTOM_RF",
  INTERPOSER_FRAME = "INTERPOSER_FRAME",
  DAUGHTER_BOARD = "DAUGHTER_BOARD",
}

export interface Dimensions2D {
  width: number;
  height: number;
}

export interface SubBoardEntityProps {
  id: SubBoardId | string;
  label: string;
  role: SubBoardRole;
  layerCount: number;
  dimensions?: Dimensions2D;
  pads?: any[];
  components?: any[];
}

export class SubBoardEntity {
  public readonly id: SubBoardId;
  public readonly label: string;
  public readonly role: SubBoardRole;
  public readonly layerCount: number;
  public readonly dimensions?: Dimensions2D;
  private readonly _pads: any[];
  private readonly _components: any[];

  constructor(props: SubBoardEntityProps) {
    if (props.id instanceof SubBoardId) {
      this.id = props.id;
    } else {
      this.id = new SubBoardId(props.id);
    }

    if (!props.label || props.label.trim().length === 0) {
      throw new Error("label cannot be empty");
    }
    this.label = props.label.trim();

    if (!props.role || !Object.values(SubBoardRole).includes(props.role)) {
      throw new Error(`Invalid SubBoardRole: ${props.role}`);
    }
    this.role = props.role;

    if (!Number.isInteger(props.layerCount) || props.layerCount <= 0) {
      throw new Error("layerCount must be a positive integer");
    }
    this.layerCount = props.layerCount;

    if (props.dimensions) {
      if (props.dimensions.width <= 0 || props.dimensions.height <= 0) {
        throw new Error("dimensions width and height must be positive numbers");
      }
      this.dimensions = {
        width: props.dimensions.width,
        height: props.dimensions.height,
      };
    }

    this._pads = props.pads ? [...props.pads] : [];
    this._components = props.components ? [...props.components] : [];
  }

  public get pads(): ReadonlyArray<any> {
    return Object.freeze([...this._pads]);
  }

  public get components(): ReadonlyArray<any> {
    return Object.freeze([...this._components]);
  }

  public addPad(pad: any): void {
    this._pads.push(pad);
  }

  public addComponent(component: any): void {
    this._components.push(component);
  }

  public getPad(padId: string): any | undefined {
    return this._pads.find((p) => (p.id === padId || p.id?.value === padId));
  }

  public getComponent(componentId: string): any | undefined {
    return this._components.find((c) => (c.id === componentId || c.id?.value === componentId));
  }
}
