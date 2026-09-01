# Delta for Workbench

## Purpose

The `workbench` domain is the unified session shell. It composes existing facades (catalog, boardview, schematics, measurements) behind a `WorkbenchFacade`, owns the multi-panel layout, and orchestrates cross-panel shared selection/net state. NEW domain — full spec.

## Requirements

### Requirement: Multi-Panel Synchronized Layout

The workbench MUST render a synchronized multi-panel layout comprising boardview, schematic, net navigator, and measurement capture panels in a single session.

The system MUST support panel resize, pinch, and split capabilities with persisted geometry.

#### Scenario: Open board yields default layout

- GIVEN the workbench is started on a fresh session
- WHEN a user opens a board
- THEN a boardview panel AND an auto-paired schematic panel render side-by-side
- AND the net navigator and measurement capture panels are present in docked positions

#### Scenario: Panel resize persists

- GIVEN a user resizes the schematic panel to 70% width
- WHEN the session is saved and reloaded
- THEN the schematic panel renders at the saved 70% width

### Requirement: Cross-Panel Synchronization

The workbench MUST propagate a single shared selection (net, pin, or component) across all panels.

Selecting a net in boardview MUST highlight it in schematic and filter the net navigator.

The system MUST emit selection events through the workbench event bus for bidirectional propagation.

#### Scenario: Net selection propagates bidirectionally

- GIVEN a loaded board and paired schematic
- WHEN a user clicks a net in the boardview panel
- THEN the matching net highlights in the schematic panel
- AND the net navigator filters to that net
- AND clicking the same net in the schematic highlights the boardview counterpart

#### Scenario: Selection with no counterpart

- GIVEN a net exists only in boardview, not the schematic
- WHEN the user selects it
- THEN the schematic panel shows no highlight for that net
- AND the navigator still lists the net with a "not in schematic" marker

### Requirement: Keyboard Shortcuts

The workbench MUST provide keyboard shortcuts for power users: net selection jump, panel focus, cross-probe toggle, and measurement quick-capture.

#### Scenario: Keyboard focus switches panels

- GIVEN the workbench has focus
- WHEN a user presses the schematic panel shortcut
- THEN keyboard focus moves to the schematic panel
- AND subsequent net navigation acts on that panel

### Requirement: WorkbenchFacade Composition

The workbench SHALL expose a `WorkbenchFacade` that composes existing catalog, boardview, schematics, and measurements facades without modifying domain behavior.

The facade MUST preserve all existing facade/domain test contracts unchanged.

#### Scenario: Facade delegates without domain change

- GIVEN existing boardview, schematics, and measurements facades
- WHEN `WorkbenchFacade` invokes their methods
- THEN all existing tests pass unchanged
- AND no `src/domain` file is modified

## Technical Constraints

- OWASP ASVS L2 compliance MUST be maintained across all panel I/O.
- Rendering MUST remain frontend-only; `src/domain` is explicitly untouched.

## Dependencies

- Existing facades, `SchematicCrossProbeIndex`
- `search` spec (multi-field search), `session` spec (persistence)
