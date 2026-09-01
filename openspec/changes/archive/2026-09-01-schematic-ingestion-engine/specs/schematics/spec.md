# OpenSpec Requirement Specification: `schematics`

**Domain:** `schematics`  
**Change:** `schematic-ingestion-engine`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY)  

---

## 1. Domain Requirements

### 1.1 Schematic Ingestion & Format Detection
* The ingestion engine MUST validate input file signatures against recognized Magic MIME types (Vector PDF, CAD Netlist).
* The parser SHALL execute asynchronously without blocking the host main event loop.
* Upon successful stream parsing, the engine MUST emit `SchematicIngestionCompleted` domain events.
* Unsupported binary or textual formats MUST be rejected immediately with `UnsupportedFormatError`.

#### Scenario 1.1.1: Successful Vector PDF Ingestion (Happy Path)
- **GIVEN** a valid vector PDF schematic payload with `%PDF-` magic header
- **WHEN** the ingestion engine parses the stream
- **THEN** the parsing executes asynchronously without blocking the event loop
- **AND** a `SchematicIngestionCompleted` domain event is emitted containing the parsed document ID.

#### Scenario 1.1.2: Unsupported MIME Rejection (Error State)
- **GIVEN** an arbitrary binary file with unrecognized magic header `0x89504E47`
- **WHEN** ingestion is initiated
- **THEN** the engine MUST reject the file with `UnsupportedFormatError`
- **AND** no domain aggregate SHALL be allocated.

---

### 1.2 Schematic Domain Aggregate Integrity
* The engine MUST construct a fully normalized `SchematicDocument` aggregate root.
* Each document SHALL contain one or more `SchematicSheet` instances.
* Each sheet MUST encapsulate `SchematicSymbol` entities with valid `RefDes`, component value, and package footprint.
* Symbols MUST declare child `SchematicPin` definitions associated with `SchematicNet` logical identifiers.

#### Scenario 1.2.1: Multi-Sheet Aggregate Assembly (Happy Path)
- **GIVEN** a multi-page schematic stream containing symbols `U2700`, `R101`, and pin connections
- **WHEN** the document aggregate is constructed
- **THEN** `SchematicDocument` MUST contain distinct `SchematicSheet` entities for each page
- **AND** all symbols SHALL have non-empty `RefDes`, value, package footprint, and pin-to-net bindings.

#### Scenario 1.2.2: Duplicate RefDes Disambiguation (Edge Case)
- **GIVEN** a split multi-unit IC symbol with identical `RefDes` (`U2700_A`, `U2700_B`) across sheets
- **WHEN** domain aggregate validation executes
- **THEN** the symbols MUST be aggregated under the parent `RefDes` `U2700`
- **AND** all pin definitions across both sheets MUST resolve uniquely without collision.

---

### 1.3 Bidirectional Cross-Probe Indexing
* The domain MUST build an in-memory bidirectional spatial index linking schematic coordinates to BoardView physical layout entities.
* Resolving `RefDes.Pin` to `SchematicPinHit` MUST execute in sub-millisecond lookup latency (< 1 ms).
* Resolving `NetName` to `BoardViewPadHit` MUST execute in sub-millisecond lookup latency (< 1 ms).

#### Scenario 1.3.1: Component Pin Cross-Probe Lookup (Happy Path)
- **GIVEN** an indexed `SchematicDocument` and corresponding BoardView layout
- **WHEN** querying cross-probe coordinates for `RefDes` `U2700` and pin `A12`
- **THEN** the index MUST return `SchematicPinHit` with exact sheet number and bounding box coordinates
- **AND** the lookup duration SHALL complete in under 1 millisecond.

#### Scenario 1.3.2: Unconnected Net Resolution (Edge Case)
- **GIVEN** a testpoint net `TP_DEBUG_TX` present in schematics but unrouted in BoardView
- **WHEN** resolving `NetName` to `BoardViewPadHit`
- **THEN** the index MUST return an empty match set without throwing exceptions
- **AND** the query response time SHALL remain below 1 millisecond.

---

### 1.4 Error Handling & Corrupted Stream Recovery
* Malformed PDF streams, truncated byte buffers, or invalid CAD syntax MUST fail gracefully with typed domain errors.
* The parser MUST NOT crash or leak partial unvalidated aggregates into the domain repository.

#### Scenario 1.4.1: Truncated Vector Stream Failure (Error State)
- **GIVEN** a corrupted PDF stream truncated at byte offset 1024
- **WHEN** the parser attempts to decode the stream
- **THEN** the engine MUST throw `CorruptedStreamError`
- **AND** the system state MUST remain clean with no orphaned aggregate created.

#### Scenario 1.4.2: Partial Sheet Corruption Resiliency (Edge Case)
- **GIVEN** a 10-page document where page 5 contains invalid vector bytecode
- **WHEN** the parser processes the document in resilient mode
- **THEN** the engine MUST emit a `SheetParsingWarning` for page 5
- **AND** all remaining 9 valid sheets MUST be successfully indexed in the `SchematicDocument`.
