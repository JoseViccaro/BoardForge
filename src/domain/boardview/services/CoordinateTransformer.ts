import { LayerCoordinate } from "../value-objects/LayerCoordinate.js";
import { LayerSide } from "../value-objects/LayerSide.js";

function roundPrecision(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export interface Coordinate3D {
  x: number;
  y: number;
  z: number;
}

export class CoordinateTransformer {
  /**
   * Flips X coordinate across the vertical centerline when viewing B-side (bottom).
   * Formula: X_mirrored = boardWidth - X_original
   * If the coordinate is already on BOTTOM_SIDE, it returns the coordinate unchanged (idempotent).
   */
  public static flipHorizontal(coord: LayerCoordinate, boardWidth: number): LayerCoordinate {
    if (coord.side === LayerSide.BOTTOM_SIDE) {
      return coord;
    }
    return new LayerCoordinate(
      roundPrecision(boardWidth - coord.x, 4),
      coord.y,
      LayerSide.BOTTOM_SIDE,
      coord.zIndex
    );
  }

  /**
   * Translates 2D coordinates for viewport alignment or exploded layout.
   */
  public static translate(coord: LayerCoordinate, offsetX: number, offsetY: number): LayerCoordinate {
    return new LayerCoordinate(
      roundPrecision(coord.x + offsetX, 4),
      roundPrecision(coord.y + offsetY, 4),
      coord.side,
      coord.zIndex
    );
  }

  /**
   * 3D Exploded multi-layer translation with stacking delta.
   */
  public static stackTransform(coord: LayerCoordinate, layerSpacingZ: number): Coordinate3D {
    return {
      x: coord.x,
      y: coord.y,
      z: roundPrecision(coord.zIndex * layerSpacingZ, 4),
    };
  }
}
