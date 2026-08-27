export class DuplicateSubBoardIdException extends Error {
  constructor(subBoardId: string) {
    super(`SubBoard with id '${subBoardId}' already exists in the CompositeBoard`);
    this.name = "DuplicateSubBoardIdException";
    Object.setPrototypeOf(this, DuplicateSubBoardIdException.prototype);
  }
}
