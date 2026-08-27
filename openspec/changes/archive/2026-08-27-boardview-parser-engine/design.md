# Technical Design: `boardview-parser-engine`

**Change ID:** `boardview-parser-engine`  
**Domain:** `boardview` / `catalog`  
**Status:** `DESIGNED`  
**Architecture Paradigm:** Clean Architecture / Hexagonal Ports & Adapters / Defensive Streaming  

---

## 1. Architectural Overview & Component Diagram

The `boardview-parser-engine` decouples heterogeneous CAD file decoding from BoardForge's core domain models (`CompositeBoard`, `SubBoardEntity`, `NetTopology`). 

```
                                [Raw CAD Input / Stream]
                                           │
                                           ▼
                            ┌──────────────────────────────┐
                            │   BoardViewFormatSniffer     │ (Magic bytes & Token inspection)
                            └──────────────┬───────────────┘
                                           │ Resolves Format
                                           ▼
                            ┌──────────────────────────────┐
                            │   BoardViewParserFactory     │
                            └──────────────┬───────────────┘
                                           │ Instantiates
               ┌───────────────────────────┼───────────────────────────┐
               ▼                           ▼                           ▼
      ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
      │ LandrexBrdParser│         │  GenCadParser   │         │FzzArchiveParser │ ... (Bdv, Tvw)
      └────────┬────────┘         └────────┬────────┘         └────────┬────────┘
               │                           │                           │
               └───────────────────────────┼───────────────────────────┘
                                           │ Uses SafeBinaryReader & Collects ParseDiagnostics
                                           ▼
                            ┌──────────────────────────────┐
                            │   RawBoardViewDocument       │ (Intermediate AST / DTO)
                            └──────────────┬───────────────┘
                                           │
                                           ▼
                            ┌──────────────────────────────┐
                            │BoardViewToCanonicalTransformer│ (Scale normalization,
                            └──────────────┬───────────────┘  coordinate mapping,
                                           │                  sandwich interposer pairing)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │ Domain Aggregates:                           │
                    │  - CompositeBoard (SubBoardEntity, Pads)     │
                    │  - NetTopology (InterposerJunctions)         │
                    └──────────────────────────────────────────────┘
```

---

## 2. Core Interfaces & Type Definitions

### 2.1 Format Types & Diagnostics
```typescript
export enum BoardViewFormat {
  LANDREX_BRD = "LANDREX_BRD",
  GENCAD = "GENCAD",
  FZZ_ARCHIVE = "FZZ_ARCHIVE",
  BDV = "BDV",
  TOPVIEW_TVW = "TOPVIEW_TVW",
  UNKNOWN = "UNKNOWN"
}

export enum DiagnosticSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  FATAL = "FATAL"
}

export interface ParseDiagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly byteOffset?: number;
  readonly context?: Record<string, unknown>;
}
```

### 2.2 Intermediate AST (`RawBoardViewDocument`)
```typescript
export interface RawPin {
  readonly id: string;
  readonly componentRefDes: string;
  readonly pinRef: string;
  readonly x: number;
  readonly y: number;
  readonly side: "TOP" | "BOTTOM";
  readonly netName: string;
  readonly nailId?: string;
  readonly diameter?: number;
}

export interface RawComponent {
  readonly refDes: string;
  readonly footprint: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly side: "TOP" | "BOTTOM";
  readonly pinCount: number;
}

export interface RawNail {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly side: "TOP" | "BOTTOM";
  readonly netName: string;
}

export interface RawBoardOutline {
  readonly width: number;
  readonly height: number;
  readonly outlinePoints: Array<{ x: number; y: number }>;
}

export interface RawBoardViewDocument {
  readonly format: BoardViewFormat;
  readonly version?: string;
  readonly outline: RawBoardOutline;
  readonly components: ReadonlyArray<RawComponent>;
  readonly pins: ReadonlyArray<RawPin>;
  readonly nails: ReadonlyArray<RawNail>;
  readonly nets: ReadonlyArray<{ name: string; pinIds: string[] }>;
}

export interface ParsedBoardViewResult {
  readonly success: boolean;
  readonly document?: RawBoardViewDocument;
  readonly diagnostics: ReadonlyArray<ParseDiagnostic>;
}
```

### 2.3 Parser Interface & Factory
```typescript
export interface ParseOptions {
  readonly strictMode?: boolean;
  readonly maxMemoryBytes?: number; // Defaults to 128 MB
  readonly defaultUnit?: "mm" | "mils" | "inches";
}

export interface IBoardViewParser {
  readonly supportedFormat: BoardViewFormat;
  canParse(headerBytes: Uint8Array, filename?: string): boolean;
  parse(content: Uint8Array | string, options?: ParseOptions): Promise<ParsedBoardViewResult>;
}

export interface IBoardViewParserFactory {
  getParser(format: BoardViewFormat): IBoardViewParser;
  detectAndGetParser(content: Uint8Array, filename?: string): { parser: IBoardViewParser; format: BoardViewFormat };
}
```

---

## 3. Detailed Component Designs

### 3.1 Defensive Binary Reader (`SafeBinaryReader`)
The `SafeBinaryReader` wraps `Uint8Array` / `ArrayBuffer` with uncompromising bounds validation:
- **`constructor(buffer: Uint8Array, maxAllowedBytes = 134_217_728)`**: Checks buffer size does not exceed `maxAllowedBytes` (128 MB).
- **Methods**:
  - `readUint8()`, `readInt16LE()`, `readUint16LE()`, `readInt32LE()`, `readUint32LE()`, `readFloatLE()`, `readDoubleLE()`
  - `readFixedString(length: number, encoding?: 'ascii' | 'utf-8')`: Enforces `length <= 2048`.
  - `readNullTerminatedString(maxLength = 2048)`: Reads until `\0` or `maxLength` without unbounded scans.
  - `seek(offset: number)`: Validates `0 <= offset <= buffer.byteLength`.
  - `skip(bytes: number)`: Validates `offset + bytes <= buffer.byteLength`.
  - `slice(length: number)`: Returns sub-view while checking bounds.

### 3.2 Format Sniffer (`BoardViewFormatSniffer`)
- **Inspection Algorithm**:
  1. Inspect leading 4 bytes for ZIP signature `0x50 0x4B 0x03 0x04` (`PK\x03\x04`). If present, verify presence of `.fz` or XML manifest to declare `FZZ_ARCHIVE`.
  2. Inspect leading 1024 bytes for Landrex signatures (`BRD2`, `PCB_CAD_DATABASE`, or Landrex binary record tables) -> `LANDREX_BRD`.
  3. Case-insensitive ASCII search for `$HEADER` or `$GENCAD` in leading 1024 bytes -> `GENCAD`.
  4. Case-insensitive ASCII search for `#FORMAT: BDV` or `#PINS` / `#COMPONENTS` -> `BDV`.
  5. Inspect TopView magic bytes / block markers -> `TOPVIEW_TVW`.
  6. Return `BoardViewFormat.UNKNOWN` if no heuristic or magic match is found.

### 3.3 Individual Parsers

#### A. `GenCadParser`
- Parses ASCII tokens line-by-line using streaming regex / token dispatch:
  - `$HEADER`: Board units (`UNITS INCH`, `UNITS MM`, `UNITS MIL`), version.
  - `$BOARD`: Boundary polygon vertices.
  - `$COMPONENTS`: Component name, device type, side (`TOP` / `BOTTOM`), (x, y) placement, rotation.
  - `$PINS`: Pin coordinates, pad shape reference, pin number.
  - `$SIGNALS`: Net names mapped to component pin pairs.
- Error Tolerance: Malformed attributes in a `$TRACKS` or `$ROUTES` section log a warning diagnostic but do not abort component/pin extraction.

#### B. `LandrexBrdParser`
- Decodes Landrex binary/text record structures:
  - Header record containing format version, board dimensions, component count, pin count, nail count.
  - Sequential record tables for Nails (Test points), Components, Pins, and Nets.
  - Converts integer coordinates using Landrex scale factors to millimeters.

#### C. `FzzArchiveParser`
- Decompresses archive using safe bounded inflating with strict decompression ratio monitoring ($\le 10:1$, max 50MB).
- Parses XML parts and schematics/pcb views to extract component footprints, pin positions, and connectivity tracks.

#### D. `BdvParser`
- Tokenizes delimited text formats containing `#PINS`, `#COMPONENTS`, `#NAILS`, `#NETS`.
- Handles varied delimiter styles (whitespace, tabs, commas) gracefully.

#### E. `TopViewParser`
- Unpacks binary TVW block headers and maps coordinate structures to the intermediate AST.

### 3.4 Canonical Transformation (`BoardViewToCanonicalTransformer`)
- **Coordinate Conversion**:
  $$x_{\text{mm}} = x \times \text{unitScaleFactor}$$
  $$y_{\text{mm}} = y \times \text{unitScaleFactor}$$
- **Aggregate Construction**:
  1. Creates `PadEntity` for each raw pin with normalized `LayerCoordinate` (side, x, y).
  2. Creates `ComponentEntity` for each raw component.
  3. Creates `SubBoardEntity` populated with pads, components, and `Dimensions2D`.
  4. Assembles `CompositeBoard` (setting `BoardStackType.SINGLE_BOARD` or `BoardStackType.SANDWICH_INTERPOSER`).
  5. Builds `NetTopology` by aggregating net names, local pin bindings, and matching interposer perimeter pads to `InterposerJunction` records.

---

## 4. File Structure & Change Layout

```
src/
├── domain/
│   └── boardview/
│       ├── value-objects/
│       │   ├── BoardViewFormat.ts
│       │   └── ParseDiagnostic.ts
│       ├── intermediate/
│       │   └── RawBoardViewDocument.ts
│       ├── ports/
│       │   ├── IBoardViewParser.ts
│       │   └── IBoardViewParserFactory.ts
│       └── services/
│           ├── BoardViewFormatSniffer.ts
│           └── BoardViewToCanonicalTransformer.ts
└── infrastructure/
    └── boardview/
        ├── io/
        │   ├── SafeBinaryReader.ts
        │   └── SafeZipExtractor.ts
        └── parsers/
            ├── BoardViewParserFactory.ts
            ├── GenCadParser.ts
            ├── LandrexBrdParser.ts
            ├── FzzArchiveParser.ts
            ├── BdvParser.ts
            └── TopViewParser.ts

test/
└── domain/
    └── boardview/
        ├── BoardViewFormatSniffer.spec.ts
        ├── SafeBinaryReader.spec.ts
        ├── GenCadParser.spec.ts
        ├── LandrexBrdParser.spec.ts
        ├── FzzArchiveParser.spec.ts
        ├── BdvParser.spec.ts
        ├── TopViewParser.spec.ts
        └── BoardViewToCanonicalTransformer.spec.ts
```
