import { PowerRailNode } from "./PowerRailNode.js";

export interface RailDependencyValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface ExpectedRailStateResult {
  expectedPowered: boolean;
  reason?: string;
}

export class PowerTree {
  public readonly id: string;
  private readonly _railsByName: Map<string, PowerRailNode> = new Map();

  constructor(id: string) {
    if (!id || id.trim().length === 0) {
      throw new Error("PowerTree id cannot be empty");
    }
    this.id = id.trim();
  }

  public addRail(node: PowerRailNode): void {
    if (this._railsByName.has(node.railName)) {
      throw new Error(`Duplicate power rail: ${node.railName}`);
    }
    this._railsByName.set(node.railName, node);
  }

  public getRail(railName: string): PowerRailNode | undefined {
    return this._railsByName.get(railName);
  }

  public getAllRails(): ReadonlyArray<PowerRailNode> {
    return Array.from(this._railsByName.values());
  }

  public getRoots(): ReadonlyArray<PowerRailNode> {
    return Array.from(this._railsByName.values()).filter(
      (rail) => rail.parentRailName === null || !this._railsByName.has(rail.parentRailName)
    );
  }

  public getChildren(parentRailName: string): ReadonlyArray<PowerRailNode> {
    return Array.from(this._railsByName.values()).filter(
      (rail) => rail.parentRailName === parentRailName
    );
  }

  public setRailPowered(railName: string, isPowered: boolean): void {
    const rail = this._railsByName.get(railName);
    if (!rail) {
      throw new Error(`Power rail not found: ${railName}`);
    }
    rail.setPowered(isPowered);
  }

  public powerDownDescendants(railName: string): void {
    const children = this.getChildren(railName);
    for (const child of children) {
      child.setPowered(false);
      this.powerDownDescendants(child.railName);
    }
  }

  public validateRailDependency(railName: string): RailDependencyValidationResult {
    const rail = this._railsByName.get(railName);
    if (!rail) {
      return {
        isValid: false,
        reason: `Rail not found: ${railName}`,
      };
    }

    if (rail.isPowered && rail.parentRailName) {
      const parent = this._railsByName.get(rail.parentRailName);
      if (!parent) {
        return {
          isValid: false,
          reason: `Parent rail ${rail.parentRailName} not found`,
        };
      }
      if (!parent.isPowered) {
        return {
          isValid: false,
          reason: `Parent rail ${rail.parentRailName} inactive`,
        };
      }
    }

    return { isValid: true };
  }

  public evaluateExpectedState(railName: string): ExpectedRailStateResult {
    const rail = this._railsByName.get(railName);
    if (!rail) {
      return {
        expectedPowered: false,
        reason: `Rail not found: ${railName}`,
      };
    }

    if (rail.parentRailName) {
      const parent = this._railsByName.get(rail.parentRailName);
      if (!parent || !parent.isPowered) {
        return {
          expectedPowered: false,
          reason: `Parent rail ${rail.parentRailName} inactive`,
        };
      }
    }

    return {
      expectedPowered: true,
    };
  }
}
