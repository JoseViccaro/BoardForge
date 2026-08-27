import { BoardId } from "../../catalog/value-objects/BoardId.js";
import { DiagnosticBoardState } from "../value-objects/DiagnosticBoardState.js";
import { MeasurementReference } from "../entities/MeasurementReference.js";

export interface MeasurementProfileProps {
  id: string;
  boardId: BoardId | string;
  title: string;
  baseline?: string;
  references?: MeasurementReference[];
}

export class MeasurementProfile {
  public readonly id: string;
  public readonly boardId: BoardId;
  public readonly title: string;
  public readonly baseline: string;
  private readonly _references: MeasurementReference[];

  // Compound key index: `${padId}::${boardState}` -> MeasurementReference
  private readonly _indexMap: Map<string, MeasurementReference> = new Map();
  // Pad index: padId -> MeasurementReference[]
  private readonly _padIndexMap: Map<string, MeasurementReference[]> = new Map();
  // State index: DiagnosticBoardState -> MeasurementReference[]
  private readonly _stateIndexMap: Map<DiagnosticBoardState, MeasurementReference[]> = new Map();

  constructor(props: MeasurementProfileProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("id cannot be empty");
    }
    if (!props.title || props.title.trim().length === 0) {
      throw new Error("title cannot be empty");
    }

    this.id = props.id.trim();
    this.boardId = props.boardId instanceof BoardId ? props.boardId : new BoardId(props.boardId);
    this.title = props.title.trim();
    this.baseline = props.baseline ? props.baseline.trim() : "FLUKE_115_STANDARD";
    this._references = [];

    if (props.references) {
      for (const ref of props.references) {
        this.addReference(ref);
      }
    }
  }

  public get references(): ReadonlyArray<MeasurementReference> {
    return Object.freeze([...this._references]);
  }

  private buildKey(padId: string, state: DiagnosticBoardState): string {
    return `${padId.trim()}::${state}`;
  }

  public addReference(ref: MeasurementReference): void {
    const key = this.buildKey(ref.padId, ref.boardState);
    this._references.push(ref);
    this._indexMap.set(key, ref);

    if (!this._padIndexMap.has(ref.padId)) {
      this._padIndexMap.set(ref.padId, []);
    }
    this._padIndexMap.get(ref.padId)!.push(ref);

    if (!this._stateIndexMap.has(ref.boardState)) {
      this._stateIndexMap.set(ref.boardState, []);
    }
    this._stateIndexMap.get(ref.boardState)!.push(ref);
  }

  public getReference(
    padId: string,
    state: DiagnosticBoardState
  ): MeasurementReference | undefined {
    const key = this.buildKey(padId, state);
    return this._indexMap.get(key);
  }

  public getAllReferencesForPad(padId: string): ReadonlyArray<MeasurementReference> {
    const refs = this._padIndexMap.get(padId.trim()) ?? [];
    return Object.freeze([...refs]);
  }

  public getAllReferencesForState(
    state: DiagnosticBoardState
  ): ReadonlyArray<MeasurementReference> {
    const refs = this._stateIndexMap.get(state) ?? [];
    return Object.freeze([...refs]);
  }
}
