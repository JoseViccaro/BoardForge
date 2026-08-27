import { BoardId } from "../value-objects/BoardId.js";
import { BoardStackType } from "../value-objects/BoardStackType.js";
import { SubBoardEntity, SubBoardRole } from "./SubBoardEntity.js";
import { DuplicateSubBoardIdException } from "../exceptions/DuplicateSubBoardIdException.js";
import { SubBoardId } from "../value-objects/SubBoardId.js";

export interface CompositeBoardProps {
  id: BoardId | string;
  boardNumber: string;
  stackType: BoardStackType;
  subBoards?: SubBoardEntity[];
}

export class CompositeBoard {
  public readonly id: BoardId;
  public readonly boardNumber: string;
  public readonly stackType: BoardStackType;
  private readonly _subBoards: SubBoardEntity[];

  constructor(props: CompositeBoardProps) {
    if (props.id instanceof BoardId) {
      this.id = props.id;
    } else {
      this.id = new BoardId(props.id);
    }

    if (!props.boardNumber || props.boardNumber.trim().length === 0) {
      throw new Error("boardNumber cannot be empty");
    }
    this.boardNumber = props.boardNumber.trim();

    if (!props.stackType || !Object.values(BoardStackType).includes(props.stackType)) {
      throw new Error(`Invalid BoardStackType: ${props.stackType}`);
    }
    this.stackType = props.stackType;

    this._subBoards = [];
    if (props.subBoards && props.subBoards.length > 0) {
      for (const subBoard of props.subBoards) {
        this.addSubBoard(subBoard);
      }
    }

    this.validateIntegrity();
  }

  public get subBoards(): ReadonlyArray<SubBoardEntity> {
    return Object.freeze([...this._subBoards]);
  }

  public addSubBoard(subBoard: SubBoardEntity): void {
    const exists = this._subBoards.some((b) => b.id.equals(subBoard.id));
    if (exists) {
      throw new DuplicateSubBoardIdException(subBoard.id.value);
    }
    this._subBoards.push(subBoard);
  }

  public getSubBoard(id: SubBoardId | string): SubBoardEntity | undefined {
    const targetId = id instanceof SubBoardId ? id.value : id;
    return this._subBoards.find((b) => b.id.value === targetId);
  }

  public getSubBoardByRole(role: SubBoardRole): SubBoardEntity | undefined {
    return this._subBoards.find((b) => b.role === role);
  }

  public validateIntegrity(): void {
    if (this.stackType === BoardStackType.SANDWICH_INTERPOSER && this._subBoards.length < 2) {
      throw new Error("SANDWICH_INTERPOSER requires at least 2 sub-boards");
    }
  }
}
