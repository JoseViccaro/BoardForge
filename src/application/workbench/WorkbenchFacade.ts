import type { SchematicDocument } from "../../domain/schematics/aggregates/SchematicDocument.js";
import type { DiagnosticBoardState } from "../../domain/measurements/value-objects/DiagnosticBoardState.js";
import type { IngestBoardViewCommand } from "../boardview/commands/IngestBoardViewCommand.js";
import type { IngestBoardViewResultDto } from "../boardview/dtos/IngestBoardViewResultDto.js";
import type { DiodeEvaluationResultDto } from "../measurements/dtos/DiodeEvaluationResultDto.js";
import type { CreateReferenceDto } from "../../interfaces/http/dtos/measurements.dto.js";
import type { RecordMeasurementDto } from "../../interfaces/http/dtos/measurements.dto.js";
import {
  WorkbenchEventBus,
  type PairingDiagnostic,
} from "./WorkbenchEventBus.js";
import {
  SessionStore,
  type SessionState,
  type SessionLoadResult,
} from "./SessionStore.js";
import { WorkbenchSearchService, type SearchHit } from "./WorkbenchSearchService.js";
import { MeasurementLogStore } from "./MeasurementLogStore.js";

/**
 * WorkbenchFacade — application-layer composition root (PR 1 Platform Foundation).
 *
 * Composes the existing BoardViewFacade / SchematicsFacade / MeasurementsFacade
 * behind a single workbench contract and owns the SessionStore, MeasurementLogStore
 * and WorkbenchSearchService (stubs until PR 5/6). No `src/domain` file is touched;
 * the underlying facades keep their public contracts and existing tests unchanged.
 */

export interface BoardViewSummary {
  boardId: string;
  boardNumber: string;
  stackType?: string;
  subBoards?: unknown[];
}

/** Structural port satisfied by the existing BoardViewFacade. */
export interface BoardViewFacadePort {
  uploadBoardView(
    command: IngestBoardViewCommand,
    organizationId?: string
  ): Promise<IngestBoardViewResultDto>;
  getBoardView(boardId: string, organizationId?: string): Promise<BoardViewSummary>;
  getNets(boardId: string, search?: string, organizationId?: string): Promise<{ nets: string[] }>;
}

/** Structural port satisfied by the existing SchematicsFacade. */
export interface SchematicsFacadePort {
  saveDocument(doc: SchematicDocument): void;
  uploadSchematic(
    schematicId: string,
    file: { filename: string; buffer: Buffer },
    organizationId?: string
  ): Promise<{ schematicId: string; filename: string; pageCount: number }>;
  searchSymbols(
    schematicId: string,
    query: string,
    organizationId?: string
  ): Promise<{ matches: unknown[] }>;
  getPage(schematicId: string, pageNumber: number, organizationId?: string): Promise<unknown>;
}

/** Structural port satisfied by the existing MeasurementsFacade. */
export interface MeasurementsFacadePort {
  getReferences(
    boardId: string,
    padId?: string,
    state?: DiagnosticBoardState,
    organizationId?: string
  ): Promise<{ references: unknown[] }>;
  createReference(dto: CreateReferenceDto, organizationId?: string): Promise<unknown>;
  recordMeasurement(
    dto: RecordMeasurementDto,
    organizationId?: string
  ): Promise<DiodeEvaluationResultDto>;
}

export interface SelectionTarget {
  boardId: string;
  net?: string;
  refDes?: string;
  pin?: string;
}

export interface CompanionResolution {
  boardModel: string;
  boardRevision: string;
  schematicId?: string;
  diagnostic: PairingDiagnostic;
}

export interface OpenBoardContext {
  boardModel?: string;
  boardRevision?: string;
}

export interface WorkbenchFacadeDeps {
  boardViewFacade: BoardViewFacadePort;
  schematicsFacade: SchematicsFacadePort;
  measurementsFacade: MeasurementsFacadePort;
  bus: WorkbenchEventBus;
  sessionStore: SessionStore;
  searchService?: WorkbenchSearchService;
  measurementLogStore?: MeasurementLogStore;
  /** Board model used for companion resolution when the context does not override it. */
  defaultBoardModel?: string;
}

/** Known (boardModel, boardRevision) -> schematic fixture pairs (deterministic catalog). */
export const companionFixtures: readonly {
  boardModel: string;
  boardRevision: string;
  schematicId: string;
}[] = [
  { boardModel: "iPhone13", boardRevision: "820-02106", schematicId: "DOC_IPHONE13_820_02106" },
  { boardModel: "iPhone13", boardRevision: "REV1", schematicId: "DOC_IPHONE13_820_02106" },
];

/**
 * Deterministic auto-pairing lookup. Resolves the companion schematic for a
 * (boardModel, boardRevision) pair; returns NO_COMPANION when the pair is unknown.
 */
export function resolveCompanion(boardModel: string, boardRevision: string): CompanionResolution {
  const normalizedModel = boardModel.trim().toLowerCase();
  const normalizedRevision = boardRevision.trim().toLowerCase();
  const match = companionFixtures.find(
    (fixture) =>
      fixture.boardModel.toLowerCase() === normalizedModel &&
      fixture.boardRevision.toLowerCase() === normalizedRevision
  );
  if (match) {
    return {
      boardModel,
      boardRevision,
      schematicId: match.schematicId,
      diagnostic: "OK",
    };
  }
  return { boardModel, boardRevision, diagnostic: "NO_COMPANION" };
}

export class WorkbenchFacade {
  public readonly bus: WorkbenchEventBus;
  public readonly sessionStore: SessionStore;
  public readonly searchService: WorkbenchSearchService;
  public readonly measurementLogStore: MeasurementLogStore;

  constructor(private readonly deps: WorkbenchFacadeDeps) {
    this.bus = deps.bus;
    this.sessionStore = deps.sessionStore;
    this.searchService = deps.searchService ?? new WorkbenchSearchService();
    this.measurementLogStore = deps.measurementLogStore ?? new MeasurementLogStore();
  }

  /**
   * Opens a board: fetches its view through BoardViewFacade, auto-resolves the
   * companion schematic by (boardModel, boardRevision), emits pairing.resolved,
   * persists the pairing into the session, and returns the session state.
   */
  public async openBoard(boardId: string, ctx: OpenBoardContext = {}): Promise<SessionState> {
    const boardView = await this.deps.boardViewFacade.getBoardView(boardId);
    const boardModel = ctx.boardModel ?? this.deps.defaultBoardModel ?? "UNKNOWN";
    const boardRevision = ctx.boardRevision ?? boardView.boardNumber ?? "UNKNOWN";
    const resolution = resolveCompanion(boardModel, boardRevision);

    this.bus.publish("pairing.resolved", {
      boardId,
      schematicId: resolution.schematicId,
      diagnostic: resolution.diagnostic,
    });

    this.sessionStore.update({
      ...this.sessionStore.getSnapshot(),
      pairing: {
        boardId,
        schematicId: resolution.schematicId,
        diagnostic: resolution.diagnostic,
      },
    });

    return this.sessionStore.getSnapshot();
  }

  /** Emits the shared selection through the bus for cross-panel propagation. */
  public select(target: SelectionTarget): void {
    this.bus.publish("selection.change", target);
  }

  /** Delegates to MeasurementsFacade and publishes measurement.recorded. */
  public async recordMeasurement(dto: RecordMeasurementDto): Promise<DiodeEvaluationResultDto> {
    const result = await this.deps.measurementsFacade.recordMeasurement(dto);
    this.bus.publish("measurement.recorded", {
      padId: result.padId,
      netName: result.netName,
      outcome: result.outcome,
      normalizedVolts: result.normalizedVolts,
    });
    return result;
  }

  /** Delegates to WorkbenchSearchService and emits search.focus when hits exist. */
  public search(query: string): SearchHit[] {
    const hits = this.searchService.search(query);
    if (hits.length > 0) {
      this.bus.publish("search.focus", { query, hit: hits[0] });
    }
    return hits;
  }

  public async saveSession(): Promise<void> {
    await this.sessionStore.save();
  }

  public async loadSession(id?: string): Promise<SessionLoadResult> {
    return await this.sessionStore.load(id);
  }
}