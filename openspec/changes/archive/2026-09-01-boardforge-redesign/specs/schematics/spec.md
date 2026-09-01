# Delta for Schematics

## ADDED Requirements

### Requirement: Vector Token Rendering Engine

The schematic panel MUST render pages from `VectorToken` primitives (text, bounds, fontSize, pageNumber) rather than raster images.

The renderer MUST place tokens by their `BoundingBox2D` coordinates and page number, preserving normalized positions.

#### Scenario: Renders page from tokens

- GIVEN a parsed schematic page 12 with `VectorToken` entries for `U2700`, `PP_VDD_MAIN`, and `A12`
- WHEN the panel renders page 12
- THEN each token appears at its `BoundingBox2D` position
- AND no raster image asset is required

#### Scenario: Missing page yields empty canvas

- GIVEN a requested page number beyond the document's page count
- WHEN the panel tries to render it
- THEN the panel shows an empty page with a page-not-found indicator
- AND no exception escapes the renderer

### Requirement: Cross-Probe Highlight Overlay

The schematic panel MUST render an overlay highlighting components/pins/nets corresponding to the workbench shared selection.

The overlay MUST derive highlight targets from `SchematicCrossProbeIndex` reverse-mapping of the selected boardview net/pin.

#### Scenario: Boardview net highlights schematic

- GIVEN a selected boardview net `PP_VDD_MAIN` active in the workbench
- WHEN the schematic panel repaints
- THEN all schematic page occurrences of net `PP_VDD_MAIN` highlight
- AND each occurrence appears on its canonical page

#### Scenario: Highlight resolves empty

- GIVEN a boardview net with no schematic occurrence
- WHEN the overlay resolves it
- THEN no schematic element highlights
- AND the panel signals the net is not present in the schematic

### Requirement: Page Navigation Within Schematic

The schematic panel MUST support page navigation (next, previous, jump to page) across the document's pages.

#### Scenario: Jump across multi-page component

- GIVEN a `MultiPageSymbolAggregate` for `U2700` spanning pages 12–14
- WHEN a user jumps to component `U2700`
- THEN the panel navigates to page 12
- AND shows the page list `[12, 13, 14]` for that aggregate

### Requirement: Component Detail Panel

When a component is selected, the schematic panel MUST reveal a detail panel with its pin map and connected nets.

The pin map MUST list each pin with number, name, page, and coordinates from `SchematicPinLocation`.

#### Scenario: Component pin map shown

- GIVEN a selected component `U2700` on page 12
- WHEN the detail panel opens
- THEN it lists pin `A12` with name, page 12, and coordinates
- AND it lists the connected net `PP_VDD_MAIN`

## Technical Constraints

- Vector rendering MUST NOT ship raster fallback for seeded pages; raster fallback remains only for out-of-slice documents.
- Every network/selection action SHALL sanitize input per OWASP ASVS L2.

## Dependencies

- `workbench` spec (shared selection, event bus)
- `search` spec (within-schematic search)
- Existing `SchematicCrossProbeIndex`, `SchematicSpatialIndex`
