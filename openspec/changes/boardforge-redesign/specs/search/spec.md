# Delta for Search

## Purpose

The `search` domain provides multi-field unified search across the loaded workbench session: net name, designator, part number, and symptom. NEW domain — full spec.

## Requirements

### Requirement: Multi-Field Unified Search

The system MUST execute a single unified search across four fields: net name, component designator, part number, and symptom reference.

The search MUST match partial input (prefix/substring) and return results ranked by field relevance.

The system SHALL return results scoped to the context of which board and which panel produced each hit.

#### Scenario: Net-name substring match

- GIVEN a loaded iPhone 13 board
- WHEN a user searches "VDD_MAIN"
- THEN results include net `PP_VDD_MAIN` with its originating board and panel context

#### Scenario: Designator match

- GIVEN a user searches "U2700"
- THEN results include component `U2700`
- AND the schematic panel context is returned for that hit

#### Scenario: Part number match

- GIVEN a user searches part number "PMX60"
- THEN results include the component with that part number and its board context

### Requirement: Real-Time Results with Context

The system MUST return results incrementally as the user types, showing for each result which panel it belongs to (boardview, schematic, navigator) and which board.

#### Scenario: Incremental results with panel context

- GIVEN a user types "pp_v"
- WHEN the search runs per keystroke
- THEN results appear before the query is submitted
- AND each result labels its panel and board origin

### Requirement: Search History

The system MUST record a per-session search history of executed queries, newest first.

The system SHALL persist search history as part of the session for restore on reload.

#### Scenario: History recorded and replayed

- GIVEN a user executes searches `"VDD_MAIN"` then `"U2700"`
- WHEN the history is queried
- THEN it returns `["U2700", "VDD_MAIN"]` newest-first
- AND after a reload, the history is restored

#### Scenario: History deduped

- GIVEN a user executes `"VDD_MAIN"` twice consecutively
- WHEN the history is queried
- THEN it contains a single entry for `"VDD_MAIN"` at the newest position

### Requirement: Symptom Reference Search

The system MUST support searching symptom references (e.g. "no power", "short to ground") and map them to likely nets/components via the measurement reference data.

#### Scenario: Symptom maps to candidates

- GIVEN a symptom query "short to ground"
- WHEN search runs against symptom references
- THEN results include nets flagged with `CRITICAL_LOW_OR_SHORT` references as candidate culprits

## Technical Constraints

- Search MUST NOT trigger backend/domain changes; it operates over the loaded workbench session.
- All query text SHALL be sanitized per OWASP ASVS L2 to prevent injection.

## Dependencies

- `workbench` spec (shared selection — selecting a hit propagates to panels)
- `session` spec (search history persistence)
- `measurements` spec (symptom↔reference mapping)
