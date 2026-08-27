# OpenSpec Requirement Specification: `boardview`

**Change ID:** `iphone13-board-core`  
**Domain:** `boardview`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY)  
**Target Entities:** `InterposerJunction`, `CoordinateTransform`, `LayerOrientation`, `BidirectionalNetResolver`

---

## 1. Domain Overview

The `boardview` domain governs 2D/3D spatial geometry, pad/pin/via locations, coordinate system transformations across stacked sub-boards, and cross-board electrical net resolution.

---

## 2. Formal Requirements

### Requirement 2.1: Interposer Junction Mapping
* An `InterposerJunction` MUST link a top sub-board pad (`top_pad_id`), an interposer perimeter pad/ball (`interposer_ball_id`), and a bottom sub-board pad (`bottom_pad_id`) to a single canonical `composite_net_id`.
* If a net terminates solely on one sub-board without bridging across the interposer, the junction MAY omit the opposite sub-board pad link (`NULL` / `None`).
* The system MUST enforce referential integrity such that every referenced pad ID exists in its respective `SubBoardEntity`.

### Requirement 2.2: Coordinate Transformations & Layer Flipping
* Each `SubBoardEntity` MUST define its own 2D Cartesian coordinate space in millimeters (`mm`) with origin `(0.0, 0.0)`.
* The domain MUST provide pure `CoordinateTransform` functions for:
  1. `FlipHorizontal(x, y, board_width)`: Translates coordinates when switching between A-side (Top) and B-side (Bottom) of a sub-board.
  2. `TranslateSubBoard(x, y, offset_x, offset_y)`: Offsets sub-board relative to the composite viewport.
  3. `StackTransform(x, y, z_index)`: 3D multi-layer displacement for exploded view rendering.
* Coordinate transformations MUST be deterministic and maintain floating-point precision within $\pm 0.0001\text{ mm}$.

### Requirement 2.3: Bidirectional Netlist Pin-to-Pad Resolution
* Given a component pin on the Top AP board (e.g., `U2700.A12`), the `BidirectionalNetResolver` MUST resolve the full electrical path across:
  1. Local sub-board net alias (`PP_VDD_MAIN`),
  2. The corresponding `InterposerJunction` pad (e.g., `PAD_84`),
  3. The bottom sub-board pad and destination component pin (e.g., `U_BB_PMU.C4` / `PP_VDD_RF_MAIN`).
* Given an Interposer pad ID, the resolver MUST return all connected component pins on both Top and Bottom sub-boards in $O(1)$ or $O(\log N)$ lookup time.

---

## 3. Given / When / Then Testable Scenarios (TDD)

### Scenario 3.1: Interposer Junction Net Resolution
```gherkin
Given a CompositeBoard "BRD_820_02106" with an InterposerJunction:
  | Junction ID | Interposer Pad | Top Pad ID    | Bottom Pad ID | Net Name    |
  | JUNC_084    | INT_PAD_084    | TOP_U2700_A12 | BOT_UBBPMU_C4 | PP_VDD_MAIN |
When resolving the net for Top board pin "TOP_U2700_A12"
Then the resolver returns net "PP_VDD_MAIN"
And the connected interposer pad is "INT_PAD_084"
And the connected bottom board pin is "BOT_UBBPMU_C4".
```

### Scenario 3.2: SubBoard Coordinate Side Flipping
```gherkin
Given a SubBoard with width 60.0 mm and height 120.0 mm
And a component pad located at X=15.25 mm, Y=45.50 mm on the TOP side
When the coordinate transform "FlipHorizontal" is applied for the BOTTOM side view
Then the resulting coordinates MUST be X=44.75 mm (60.0 - 15.25) and Y=45.50 mm.
```

### Scenario 3.3: Bidirectional Cross-Probing from Interposer Pad
```gherkin
Given the registered iPhone 13 interposer layout
When a user clicks on Interposer Pad "INT_PAD_084"
Then the system highlights all connected traces on Top SubBoard (AP)
And highlights all connected traces on Bottom SubBoard (RF)
And returns a unified net classification of "POWER_MAIN".
```
