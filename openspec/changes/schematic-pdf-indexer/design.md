# Technical Design: `schematic-pdf-indexer`

**Change ID:** `schematic-pdf-indexer`  
**Standard:** Domain-Driven Design (DDD), Hexagonal Architecture, Strict TDD  
**Status:** PROPOSED / DESIGN READY  

---

## 1. Architectural Architecture & Component Diagram

The Schematic PDF Indexer introduces a high-performance vector extraction and cross-probing pipeline that seamlessly bridges vector schematic documents (PDF/SVG/Vector stream) with physical PCB CAD layouts (`BoardView`, `NetTopology`, `InterposerJunction`).

```
+---------------------------------------------------------------------------------------------------+
|                                  APPLICATION LAYER                                                |
|  [IngestSchematicDocumentUseCase]           [CrossProbeSchematicUseCase]                          |
|  [SearchSchematicTokensUseCase]             [ResolveMultiPageSymbolUseCase]                       |
+---------------------------------------------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------------------+
|                                    DOMAIN LAYER (`schematics`)                                    |
|                                                                                                   |
|  +-----------------------------+       +-----------------------------+                            |
|  |     SchematicDocument       | <---> |   MultiPageSymbolAggregate  |                            |
|  | (Aggregate Root / Document) |       |  (Aggregates multi-bank IC) |                            |
|  +-----------------------------+       +-----------------------------+                            |
|                 |                                     |                                           |
|                 v                                     v                                           |
|  +-----------------------------+       +-----------------------------+                            |
|  |        SchematicPage        |       |       SchematicSymbol       |                            |
|  |     (Page Entity / Dims)    |       |   (RefDes, Box, Bank, Pins) |                            |
|  +-----------------------------+       +-----------------------------+                            |
|                 |                                     |                                           |
|                 v                                     v                                           |
|  +-----------------------------+       +-----------------------------+                            |
|  |    SchematicSpatialIndex    |       |    SchematicPinLocation     |                            |
|  |     (2D R-Tree / Boxes)     |       | (Pin #, Pin Name, Pt, Box)  |                            |
|  +-----------------------------+       +-----------------------------+                            |
|                 |                                     |                                           |
|                 v                                     v                                           |
|  +-----------------------------+       +-----------------------------+                            |
|  |     VectorToken / Box2D     |       |  SchematicCrossProbeIndex   |                            |
|  |    (Immutable Value Obj)    |       | (Bidirectional Spatial Map) |                            |
|  +-----------------------------+       +-----------------------------+                            |
|                                                       |                                           |
+-------------------------------------------------------|-------------------------------------------+
                                                        |
                                                        v
+---------------------------------------------------------------------------------------------------+
|                                    DOMAIN LAYER (`boardview`)                                     |
|  [NetTopology] <--------> [SubBoardEntity] <--------> [PadEntity] <--------> [InterposerJunction] |
+---------------------------------------------------------------------------------------------------+
                                                        |
                                                        v
+---------------------------------------------------------------------------------------------------+
|                                     INFRASTRUCTURE LAYER                                          |
|  [PdfVectorStreamExtractor]                 [RTreeSpatialEngine]                                  |
|  [RegexSymbolPatternEngine]                 [iPhone13SchematicFixtures]                           |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Domain Entities & Value Objects

### 2.1 Value Objects

1. **`BoundingBox2D`** (`src/domain/schematics/value-objects/BoundingBox2D.ts`):
   - Fields: `readonly minX: number`, `readonly minY: number`, `readonly maxX: number`, `readonly maxY: number`.
   - Invariants: `minX <= maxX`, `minY <= maxY`.
   - Methods:
     - `containsPoint(x: number, y: number): boolean`
     - `intersects(other: BoundingBox2D): boolean`
     - `union(other: BoundingBox2D): BoundingBox2D`
     - `expand(margin: number): BoundingBox2D`
     - `get width(): number`, `get height(): number`, `get area(): number`
     - `get center(): { x: number, y: number }`

2. **`SchematicCoordinate`** (`src/domain/schematics/value-objects/SchematicCoordinate.ts`):
   - Fields: `readonly pageNumber: number`, `readonly x: number`, `readonly y: number`.
   - Methods: `distanceTo(other: SchematicCoordinate): number`.

3. **`VectorToken`** (`src/domain/schematics/value-objects/VectorToken.ts`):
   - Fields:
     - `readonly text: string`
     - `readonly pageNumber: number`
     - `readonly bounds: BoundingBox2D`
     - `readonly fontSize: number`
     - `readonly fontFamily?: string`
     - `readonly rotation: number` (0, 90, 180, 270)
     - `readonly tokenType?: 'TEXT' | 'DESIGNATOR' | 'PIN_NUM' | 'PIN_NAME' | 'NET_LABEL'`

4. **`SymbolPinRef`** (`src/domain/schematics/value-objects/SymbolPinRef.ts`):
   - Fields: `readonly refDes: string`, `readonly pinNumber: string`, `readonly pinName?: string`.

5. **`NetLabelMatch`** (`src/domain/schematics/value-objects/NetLabelMatch.ts`):
   - Fields: `readonly netName: string`, `readonly pageNumber: number`, `readonly bounds: BoundingBox2D`.

---

### 2.2 Entities & Aggregates

1. **`SchematicPinLocation`** (`src/domain/schematics/entities/SchematicPinLocation.ts`):
   - State:
     - `readonly id: string`
     - `readonly refDes: string`
     - `readonly pinNumber: string`
     - `readonly pinName?: string`
     - `readonly pageNumber: number`
     - `readonly bounds: BoundingBox2D`
     - `readonly connectionPoint: { x: number, y: number }`
     - `readonly connectedNetName?: string`

2. **`SchematicSymbol`** (`src/domain/schematics/entities/SchematicSymbol.ts`):
   - State:
     - `readonly id: string`
     - `readonly refDes: string`
     - `readonly bankDesignator?: string` (e.g. `A`, `B`, `C` or `POWER`, `GPIO`)
     - `readonly pageNumber: number`
     - `readonly bounds: BoundingBox2D`
     - `readonly pins: SchematicPinLocation[]`
   - Methods:
     - `addPin(pin: SchematicPinLocation): void`
     - `findPin(pinNumber: string): SchematicPinLocation | undefined`

3. **`MultiPageSymbolAggregate`** (`src/domain/schematics/aggregates/MultiPageSymbolAggregate.ts`):
   - State:
     - `readonly refDes: string`
     - `readonly symbols: SchematicSymbol[]`
   - Methods:
     - `addSymbolBank(symbol: SchematicSymbol): void`
     - `getAllPages(): number[]`
     - `findPin(pinNumber: string): { symbol: SchematicSymbol, pin: SchematicPinLocation } | undefined`
     - `getAllPins(): SchematicPinLocation[]`

4. **`SchematicPage`** (`src/domain/schematics/entities/SchematicPage.ts`):
   - State:
     - `readonly pageNumber: number`
     - `readonly width: number`
     - `readonly height: number`
     - `readonly tokens: VectorToken[]`
     - `readonly symbols: SchematicSymbol[]`
     - `readonly netLabels: NetLabelMatch[]`
     - `private spatialIndex: SchematicSpatialIndex`
   - Methods:
     - `addToken(token: VectorToken): void`
     - `addSymbol(symbol: SchematicSymbol): void`
     - `addNetLabel(label: NetLabelMatch): void`
     - `queryPoint(x: number, y: number): VectorToken[]`
     - `queryBox(box: BoundingBox2D): VectorToken[]`
     - `findNearestToken(x: number, y: number, maxRadius: number): VectorToken | undefined`

5. **`SchematicDocument`** (`src/domain/schematics/aggregates/SchematicDocument.ts`):
   - Aggregate Root for parsed vector schematic documents.
   - State:
     - `readonly documentId: string`
     - `readonly title: string`
     - `readonly pageCount: number`
     - `readonly pages: Map<number, SchematicPage>`
     - `readonly multiPageSymbols: Map<string, MultiPageSymbolAggregate>`
   - Methods:
     - `getPage(pageNumber: number): SchematicPage | undefined`
     - `getSymbol(refDes: string): MultiPageSymbolAggregate | undefined`
     - `searchTokens(query: string, caseSensitive?: boolean): VectorToken[]`
     - `findPinsForRefDes(refDes: string): SchematicPinLocation[]`

---

## 3. Spatial R-Tree Engine & Spatial Index

### 3.1 Spatial Index Design
The spatial index enables instant sub-millisecond bounding box and proximity queries.

- **`SchematicSpatialIndex`** (`src/domain/schematics/services/SchematicSpatialIndex.ts`):
  - In-memory 2D spatial tree indexing bounding box primitives.
  - Supports node splitting, bounding box expansion, and recursive tree traversal for point and range intersection.
  - Optimized for fast page rendering highlights and viewport filtering.

---

## 4. Symbol & Net Extractor Services

### 4.1 `SymbolExtractorService` (`src/domain/schematics/services/SymbolExtractorService.ts`)
1. **Regex Classifiers**:
   - Designators:
     - ICs: `/\b(U[0-9]{1,5}[A-Z]?|U_[A-Z0-9_]+|PMU_[A-Z0-9_]+|PMX[0-9]{2,3})\b/`
     - Discrete passives: `/\b([RCLDQFL]|TP|J)[0-9]{1,5}\b/`
   - BGA / Grid Pin Numbers: `/\b([A-HJ-NP-Z][0-9]{1,3})\b/`
   - Numeric Pin Numbers: `/\b([0-9]{1,4})\b/`
   - Microelectronics Net Labels:
     - Power Rails: `/\b(PP[0-9A-Z_]+)\b/`
     - Active Low / Resets: `/\b([A-Z0-9_]+_[LN])\b/`
     - Busses: `/\b((I2C|SPI|UART|RFFE|MIPI)[0-9]_[A-Z0-9_]+)\b/`
2. **Proximity Association Algorithm**:
   - Discovers designator tokens $\rightarrow$ forms symbol bounding envelopes.
   - Discovers pin number tokens within or on perimeter of symbol envelope $\rightarrow$ assigns to parent `SchematicSymbol`.
   - Links adjacent net labels to pin connection points.

---

## 5. Bidirectional Cross-Probe Index (`SchematicCrossProbeIndex`)

### 5.1 Structure & Mapping Tables
```typescript
export interface BoardViewPinKey {
  refDes: string;
  pinNumber: string;
}

export interface SchematicPinHit {
  documentId: string;
  pageNumber: number;
  refDes: string;
  pinNumber: string;
  pinName?: string;
  bounds: BoundingBox2D;
  connectionPoint: { x: number; y: number };
  netName?: string;
}

export interface BoardViewPadHit {
  subBoardId: string;
  padId: string;
  refDes: string;
  pinNumber: string;
  netName: string;
  interposerPadId?: string | null;
}

export class SchematicCrossProbeIndex {
  // Pin Key -> Schematic Occurrences
  private pinToSchematicMap = new Map<string, SchematicPinHit[]>();
  
  // Net Name -> Schematic Occurrences
  private netToSchematicMap = new Map<string, NetLabelMatch[]>();

  // BoardView Physical Index
  private pinToBoardViewMap = new Map<string, BoardViewPadHit[]>();
  private netToBoardViewMap = new Map<string, BoardViewPadHit[]>();
  
  // Methods
  public registerSchematicDocument(doc: SchematicDocument): void;
  public registerBoardViewTopology(topology: NetTopology, subBoards: SubBoardEntity[]): void;
  
  public queryFromBoardViewPin(refDes: string, pinNumber: string): SchematicPinHit[];
  public queryFromBoardViewNet(netName: string): NetLabelMatch[];
  
  public queryFromSchematicCoordinate(pageNumber: number, x: number, y: number): {
    tokens: VectorToken[];
    pinHits: BoardViewPadHit[];
    netName?: string;
  };
}
```

---

## 6. Apple iPhone 13 Schematic Fixtures

The fixtures provide multi-page vector schematic data for the iPhone 13 (820-02106 / D63) logic board:
1. **Page 12 (PMU A15 - Main Power & Bucks)**:
   - Component `U2700` (Bank A), Pins `A12` (`PP_VDD_MAIN`), `B12` (`PP_VDD_MAIN`), `C1` (`PP_VDD_CPU_CORE`), `D1` (`PP0V85_LPDDR5`).
2. **Page 13 (PMU A15 - Standby & System Control)**:
   - Component `U2700` (Bank B), Pins `E5` (`PP1V8_S2`), `F2` (`BUTTON_TO_PMU_ONOFF_L`), `G4` (`I2C0_SDA`), `G5` (`I2C0_SCL`).
3. **Page 25 (Charger / Tigris Subsystem)**:
   - Component `U3300`, Pins `1` (`PP_BATT_VCC`), `2` (`PP_VDD_MAIN`).
4. **Page 48 (Baseband PMIC PMX60 / RF Subsystem)**:
   - Component `U_BB_PMU`, Pins `C4` (`PP_VDD_RF_MAIN`), `A1` (`PP_VDD_BOOST`).
5. **Page 84 (Interposer Solder Array & Signal Routing)**:
   - Pins `INT_PAD_084` (`PP_VDD_MAIN`), `INT_PAD_042` (`I2C0_SDA`).

---

## 7. File Change Layout

```
BoardForge/
├── openspec/
│   └── changes/
│       └── schematic-pdf-indexer/
│           ├── proposal.md
│           ├── design.md
│           ├── tasks.md
│           └── specs/
│               └── schematics/
│                   └── spec.md
├── src/
│   └── domain/
│       └── schematics/
│           ├── value-objects/
│           │   ├── BoundingBox2D.ts
│           │   ├── SchematicCoordinate.ts
│           │   ├── VectorToken.ts
│           │   ├── SymbolPinRef.ts
│           │   └── NetLabelMatch.ts
│           ├── entities/
│           │   ├── SchematicPinLocation.ts
│           │   ├── SchematicSymbol.ts
│           │   └── SchematicPage.ts
│           ├── aggregates/
│           │   ├── SchematicDocument.ts
│           │   └── MultiPageSymbolAggregate.ts
│           ├── services/
│           │   ├── SchematicSpatialIndex.ts
│           │   ├── SymbolExtractorService.ts
│           │   ├── SchematicCrossProbeIndex.ts
│           │   └── SchematicPdfParser.ts
│           └── ports/
│               └── ISchematicParser.ts
├── src/
│   └── infrastructure/
│       ├── schematics/
│       │   ├── PdfVectorStreamExtractor.ts
│       │   └── RTreeSpatialEngine.ts
│       └── seeds/
│           └── iPhone13SchematicFixtures.ts
└── tests/
    └── unit/
        └── domain/
            └── schematics/
                ├── BoundingBox2D.spec.ts
                ├── SchematicSpatialIndex.spec.ts
                ├── SymbolExtractorService.spec.ts
                ├── MultiPageSymbolAggregate.spec.ts
                ├── SchematicCrossProbeIndex.spec.ts
                └── iPhone13SchematicFixtures.spec.ts
```
