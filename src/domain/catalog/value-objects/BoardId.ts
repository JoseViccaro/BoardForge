export class BoardId {
  public readonly value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("BoardId cannot be empty");
    }
    this.value = value.trim();
  }

  public equals(other?: BoardId | null): boolean {
    if (!other || !(other instanceof BoardId)) {
      return false;
    }
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
