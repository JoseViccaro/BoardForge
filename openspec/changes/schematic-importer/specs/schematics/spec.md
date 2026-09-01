# Delta for schematics

## ADDED Requirements

### Requirement R2.15: ISchematicParser Domain Port

The schematics domain SHALL expose an `ISchematicParser` port interface that accepts raw bytes and optional metadata, returning a `SchematicDocument` or a structured error. The port MUST be implemented in `src/domain/schematics/ports/` and MUST NOT depend on any infrastructure package (`pdfjs-dist` or otherwise).

#### Scenario: Port accepts raw bytes and returns document

- GIVEN an `ISchematicParser` implementation backed by a valid vector-PDF byte array
- WHEN `parse(rawBytes, metadata)` is invoked
- THEN it returns a `SchematicDocument` with pages and tokens

#### Scenario: Port rejects invalid input

- GIVEN an `ISchematicParser` implementation
- WHEN `parse(emptyBytes, metadata)` is invoked
- THEN it returns an error with code `EMPTY_INPUT` and does not throw

---

### Requirement R2.16: Catalog-Driven Document Resolution

The schematics subsystem SHALL resolve a `SchematicDocument` by querying a manifest catalog keyed by `boardModel + boardRevision`, replacing the prior hardcoded fixture injection. `iPhone13SchematicFixtures` MUST remain available as a golden test fixture but MUST NOT be the production resolution path.

(Previously: Schematic document was always the hardcoded `iPhone13SchematicFixtures` constant.)

#### Scenario: Catalog resolves known model and revision

- GIVEN a manifest with entry `iPhone13_SCH / REV-C1` pointing to a bundle
- WHEN the workbench requests a schematic for model `iPhone13_SCH` revision `REV-C1`
- THEN the system hydrates and returns the correct `SchematicDocument`

#### Scenario: Fallback to latest revision when revision absent

- GIVEN a manifest with entries `REV-A1` (older) and `REV-C1` (latest) for `iPhone13_SCH`
- WHEN the workbench requests `iPhone13_SCH` without a revision
- THEN the system returns the `REV-C1` bundle

#### Scenario: No bundle found yields graceful fallback

- GIVEN a manifest with no entry for model `iPhone15_SCH`
- WHEN the workbench requests a schematic for `iPhone15_SCH`
- THEN the system returns a `NO_COMPANION` result
- AND the schematic panel shows an empty/missing state without throwing

#### Scenario: Golden fixture remains valid in test context

- GIVEN `iPhone13SchematicFixtures` is used in a unit test
- WHEN the test asserts against fixture tokens
- THEN the assertions pass unchanged
