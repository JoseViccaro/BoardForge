# Delta for Session

## Purpose

The `session` domain persists and restores workbench state so technicians can reload and continue an interrupted session, including open panels, positions, selections, search history, measurement sessions, and board+schematic pairing. NEW domain — full spec.

## Requirements

### Requirement: Workbench State Persistence

The system MUST persist the workbench state: open panels, their positions/sizes, current selections, and search history.

On reload, the system MUST restore the persisted state so the session continues where it left off.

#### Scenario: Full restore on reload

- GIVEN a session with the schematic panel resized, net `PP_VDD_MAIN` selected, and search history `["U2700","VDD_MAIN"]`
- WHEN the session is saved, the app is reloaded, and the session is reopened
- THEN the schematic panel renders at the saved size
- AND the net `PP_VDD_MAIN` is re-selected
- AND the search history is restored

#### Scenario: Corrupt persisted state

- GIVEN a persisted session state that fails schema validation
- WHEN the session is loaded
- THEN the system starts a fresh session
- AND logs a recoverable validation diagnostic without crashing

### Requirement: Measurement Session Persistence

The system MUST persist measurement sessions, including captured readings, meter profiles, and board states, for restore on reload.

#### Scenario: Meets restored with board state

- GIVEN a measurement session with readings for `INT_PAD_084` on `SPLIT_TOP`
- WHEN the session is reopened after reload
- THEN the measurement log and history for that pin are restored intact

### Requirement: Board & Schematic Pairing Restore

The system MUST restore the board+schematic pairing from the persisted session identifier, re-resolving the companion on load.

If the pairing cannot be re-resolved, the system SHALL surface the `NO_COMPANION` diagnostic rather than fail the session.

#### Scenario: Pairing restored on reload

- GIVEN a session with an auto-paired board and schematic
- WHEN the session is reloaded
- THEN the board re-opens and its companion schematic re-resolves automatically

#### Scenario: Unresolvable pairing on reload

- GIVEN a saved pairing whose schematic no longer resolves
- WHEN the session is reloaded
- THEN the board still loads
- AND the schematic panel shows the empty/missing companion state
- AND a diagnostic records the unresolved pairing

### Requirement: Manual Selection Restore

The system MUST restore the last shared selection across panels after a reload where the persisted net still exists.

#### Scenario: Selection restored where net exists

- GIVEN a persisted selection of net `PP_VDD_MAIN`
- WHEN the session reloads and that net is present
- THEN all panels re-highlight `PP_VDD_MAIN` consistently

#### Scenario: Selection dropped where net gone

- GIVEN a persisted selection of a net no longer present after reload
- WHEN the session reloads
- THEN no stale highlight is shown
- AND the workbench reports a cleared-selection state

## Technical Constraints

- Persistence MUST remain frontend-only; no backend/domain schema changes.
- Persisted state SHALL be validated against a schema before load per OWASP ASVS L2.

## Dependencies

- `workbench` spec (panel/selection state)
- `search` spec (search history persistence)
- `measurements` spec (measurement session persistence)
- `boardview` spec (pairing re-resolution)
