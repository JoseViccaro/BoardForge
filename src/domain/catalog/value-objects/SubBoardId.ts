export class SubBoardId {
  public readonly value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("SubBoardId cannot be empty");
    }
    this.value = value.trim();
  }

  public equals(other?: SubBoardId | null): boolean {
    if (!other || !(other instanceof SubBoardId)) {
      return false;
    }
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
