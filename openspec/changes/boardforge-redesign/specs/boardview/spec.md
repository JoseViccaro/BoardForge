# Delta for Boardview

## ADDED Requirements

### Requirement: Boardview–Schematic Auto-Pairing

The system MUST auto-resolve the companion schematic for a boardview by board model and revision, without manual user selection.

The pairing MUST be deterministic given `(boardModel, boardRevision)` and MUST fail with a resolvable diagnostic when no companion exists.

#### Scenario: Auto-resolve known companion

- GIVEN a board opened with model "iPhone 13" and revision "REV1"
- WHEN the workbench requests its companion schematic
- THEN the system returns the matching schematic document
- AND the boardview and schematic render side-by-side without manual action

#### Scenario: No companion found

- GIVEN a board with model "iPhone 11 Pro" and revision "REV3"
- AND no schematic fixture matches that exact revision
- WHEN the pair resolver runs
- THEN the system returns a "NO_COMPANION" resolution result
- AND the boardview still renders while the schematic panel shows an empty/missing state

### Requirement: Net Highlighting Synchronization

The boardview panel MUST render net highlighting that reflects the shared workbench selection at sub-second latency.

The highlight MUST visually distinguish the selected net from non-selected pads/traces per current layer orientation.

#### Scenario: Selection drives highlight

- GIVEN a shared net selection active in the workbench
- WHEN the boardview panel repaints
- THEN all pads and traces belonging to that net are highlighted
- AND non-selected components remain visually dimmed but interactive

#### Scenario: Layer flip preserves highlight

- GIVEN a highlighted net on the TOP layer
- WHEN the user flips to the BOTTOM layer view
- THEN the same net's bottom-side pads/traces remain highlighted

### Requirement: Pin Hover & Click Reveal

On pin hover, the boardview MUST reveal net info; on pin click, it MUST reveal linked schematic component details (pages, coordinates, connected nets).

The reveal data MUST come from the `SchematicCrossProbeIndex` without duplicating domain logic.

#### Scenario: Hover reveals net info

- GIVEN a pin rendered in boardview
- WHEN the user hovers over it
- THEN a tooltip shows the canonical net name and net classification

#### Scenario: Click reveals linked schematic

- GIVEN a pin with a cross-probe mapping (e.g. `TOP_U2700_A12`)
- WHEN the user clicks it
- THEN the system reveals linked schematic component `U2700`
- AND shows pages, pin coordinates, and connected net `PP_VDD_MAIN`

## Technical Constraints

- Unlimited highlight latency MUST NOT degrade cross-probe interaction; queries reuse the existing `$O(1)$/$O(\log N)$` index.
- Layer controls remain within the boardview panel per OWASP ASVS L2 input sanitization.

## Dependencies

- `workbench` spec (shared selection, event bus)
- `schematics` spec (cross-probe index)
