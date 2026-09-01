import { z } from "zod";
import { EvaluationOutcome } from "../../domain/measurements/value-objects/EvaluationOutcome.js";
import { DiagnosticBoardState } from "../../domain/measurements/value-objects/DiagnosticBoardState.js";

/**
 * SessionStore — IndexedDB-backed workbench session persistence (PR 1 + 6D).
 *
 * Persists panel geometry, shared selection, search history, measurements log,
 * and board+schematic pairing. All persisted payloads are schema-validated on
 * load per OWASP ASVS L2: corrupt JSON or schema-invalid state recovers to a
 * fresh session with a recoverable diagnostic instead of crashing.
 *
 * Unit 6D adds `restoreFullSession()` — full-session restore pipeline with
 * ASVS L2 full-schema validation of ALL persisted slices (positions, selection,
 * history, measurements, pairing). On validation failure, produces a fresh
 * session + diagnostic. Includes gone-net clearing and NO_COMPANION handling.
 *
 * The storage backend is a port (`ISessionStoragePort`) so the store stays a
 * pure application-layer unit (tested with an in-memory port); the production
 * adapter `IndexedDbSessionStorage` wraps the browser IndexedDB API.
 */

export const DEFAULT_SESSION_KEY = "boardforge.session.v1";

export interface SessionPanelState {
  id: string;
  visible: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  order?: number;
}

export const sessionStateSchema = z
  .object({
    version: z.literal(1),
    panels: z.array(
      z.object({
        id: z.string().min(1),
        visible: z.boolean(),
        position: z.object({ x: z.number(), y: z.number() }).optional(),
        size: z.object({ width: z.number(), height: z.number() }).optional(),
        order: z.number().int().min(0).optional(),
      })
    ),
    selection: z
      .object({
        boardId: z.string().min(1),
        net: z.string().optional(),
        refDes: z.string().optional(),
        pin: z.string().optional(),
      })
      .nullable()
      .optional(),
    searchHistory: z.array(z.string()),
    pairing: z
      .object({
        boardId: z.string().min(1),
        schematicId: z.string().optional(),
        diagnostic: z.enum(["OK", "NO_COMPANION"]),
      })
      .nullable()
      .optional(),
    /**
     * Serialized measurement log carried in the full-session restore pipeline
     * (6D). Absent in sessions persisted before 6D; validated per entry against
     * its full schema (ASVS L2) so stored data is never trusted verbatim.
     */
    measurements: z.array(
      z.object({
        padId: z.string().min(1),
        netName: z.string().nullable(),
        outcome: z.nativeEnum(EvaluationOutcome),
        measuredVolts: z.number(),
        normalizedVolts: z.number(),
        recordedAt: z.string(),
        boardState: z.nativeEnum(DiagnosticBoardState),
        meterModel: z.string().min(1),
      })
    ).optional(),
    updatedAt: z.string(),
  })
  .strict();

export type SessionState = z.infer<typeof sessionStateSchema>;

/**
 * A single serialized measurement-log entry carried within a restored session
 * (mirrors the `MeasurementLogEntry` shape produced by MeasurementLogStore;
 * domain enums are validated against their allowed values).
 */
export interface SessionMeasurementEntry {
  padId: string;
  netName: string | null;
  outcome: EvaluationOutcome;
  measuredVolts: number;
  normalizedVolts: number;
  recordedAt: string;
  boardState: DiagnosticBoardState;
  meterModel: string;
}

/** ASVS L2 schema for the measurements slice of a persisted session. */
export const sessionMeasurementSchema = z.object({
  padId: z.string().min(1),
  netName: z.string().nullable(),
  outcome: z.nativeEnum(EvaluationOutcome),
  measuredVolts: z.number(),
  normalizedVolts: z.number(),
  recordedAt: z.string(),
  boardState: z.nativeEnum(DiagnosticBoardState),
  meterModel: z.string().min(1),
});

/** Result of a full-session restore (R1/R2/R3/R4). */
export interface SessionRestoreResult {
  /** Restored (or fresh-on-corruption) session core state. */
  session: SessionState;
  /** Restored measurements slice; empty on corruption or nothing persisted. */
  measurements: SessionMeasurementEntry[];
  /** True when persisted data was corrupt/schema-invalid and was reset. */
  recovered: boolean;
  /** Recoverable diagnostic (e.g. CORRUPT_STATE_RESET). */
  diagnostic?: string;
}

/** Options controlling restore-time verification (gone-net clearing). */
export interface RestoreFullSessionOptions {
  /**
   * Predicate that resolves whether a board's net still exists. When it returns
   * false, the restored selection's `.net` is cleared (gone-net per R3). Omitted
   * when the caller has no authoritative net catalog at restore time.
   */
  checkNet?: (boardId: string, net: string) => Promise<boolean>;
}

export interface SessionLoadResult {
  state: SessionState;
  recovered: boolean;
  diagnostic?: string;
}

export interface ISessionStoragePort {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export function createInitialSessionState(): SessionState {
  return {
    version: 1,
    panels: [
      { id: "boardview", visible: true, order: 0 },
      { id: "schematics", visible: true, order: 1 },
      { id: "navigator", visible: true, order: 2 },
      { id: "measurements", visible: true, order: 3 },
    ],
    searchHistory: [],
    updatedAt: new Date(0).toISOString(),
  };
}

/** Pure parse + ASVS L2 schema validation. Returns null for corrupt/invalid payloads. */
export function parseSessionState(raw: string): SessionState | null {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = sessionStateSchema.safeParse(candidate);
  return result.success ? result.data : null;
}

export class SessionStore {
  private current: SessionState;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly port: ISessionStoragePort,
    private readonly key: string = DEFAULT_SESSION_KEY
  ) {
    this.current = createInitialSessionState();
  }

  /** Referentially-stable snapshot for useSyncExternalStore. */
  public getSnapshot(): SessionState {
    return this.current;
  }

  /** Registers a change listener; returns an unsubscribe function. */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Replaces the in-memory state (schema-validated) and notifies listeners. */
  public update(next: SessionState): SessionState {
    const parsed = sessionStateSchema.safeParse(next);
    this.current = parsed.success ? parsed.data : createInitialSessionState();
    this.notify();
    return this.current;
  }

  /** Persists the current snapshot to the storage port. */
  public async save(): Promise<void> {
    await this.port.write(this.key, JSON.stringify(this.current));
  }

  /**
   * Loads a session from the storage port. Corrupt or schema-invalid persisted
   * state recovers to a fresh session and reports a diagnostic (ASVS L2).
   */
  public async load(id?: string): Promise<SessionLoadResult> {
    const key = id ? sessionKeyFor(id) : this.key;
    const raw = await this.port.read(key);
    if (raw === null) {
      return { state: this.current, recovered: false };
    }

    const parsed = parseSessionState(raw);
    if (parsed === null) {
      this.current = createInitialSessionState();
      this.notify();
      return {
        state: this.current,
        recovered: true,
        diagnostic: "CORRUPT_STATE_RESET",
      };
    }

    this.current = parsed;
    this.notify();
    return { state: this.current, recovered: false };
  }

  /**
   * Restores the FULL session pipeline (positions, selection, history,
   * measurements, pairing) from the storage port. Per OWASP ASVS L2, stored
   * session data is never trusted before restore: every persisted slice is
   * schema-validated, and on any corruption/invalid field the store fail-safes
   * to a fresh session + recoverable diagnostic (never throws). The optional
   * measure slip notifies when state changed (no-op when nothing persisted).
   *
   * Gone-net handling (R3): when `checkNet` is provided, a stale selected net
   * that no longer exists is cleared from the restored selection. NO_COMPANION
   * pairings are preserved as-is.
   */
  public async restoreFullSession(
    options: RestoreFullSessionOptions = {}
  ): Promise<SessionRestoreResult> {
    const raw = await this.port.read(this.key);
    if (raw === null) {
      return { session: this.current, measurements: [], recovered: false };
    }

    const parsed = parseSessionState(raw);
    if (parsed === null) {
      return this.resetToFresh("CORRUPT_STATE_RESET");
    }

    // ASVS L2: the measurements slice is schema-validated as part of the full
    // session schema above (absent in pre-6D sessions → empty). Invalid entry
    // shapes fail the whole state parse → recovered fresh above.
    const measurements: SessionMeasurementEntry[] = parsed.measurements ?? [];

    const session = parsed;
    if (options.checkNet && session.selection?.net) {
      const exists = await options.checkNet(session.selection.boardId, session.selection.net);
      if (!exists) {
        session.selection = {
          boardId: session.selection.boardId,
          refDes: session.selection.refDes,
          pin: session.selection.pin,
        };
      }
    }

    this.current = session;
    this.notify();
    return {
      session: this.current,
      measurements,
      recovered: false,
    };
  }

  /**
   * Resets the store to a fresh session, notifies subscribers, and returns a
   * recovered result carrying the given diagnostic. Shared by all fail-safe
   * paths (corrupt JSON / schema-invalid / invalid slice).
   */
  private resetToFresh(diagnostic: string): SessionRestoreResult {
    this.current = createInitialSessionState();
    this.notify();
    return {
      session: this.current,
      measurements: [],
      recovered: true,
      diagnostic,
    };
  }

  /** Removes all listeners. */
  public dispose(): void {
    this.listeners.clear();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function sessionKeyFor(id: string): string {
  return `boardforge.session.${id}`;
}

/** Production IndexedDB adapter for the session storage port (browser only). */
export class IndexedDbSessionStorage implements ISessionStoragePort {
  private readonly dbName = "boardforge";
  private readonly storeName = "sessions";
  private dbPromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available in this environment."));
        return;
      }
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("IndexedDB open failed."));
    });
    return this.dbPromise;
  }

  public async read(key: string): Promise<string | null> {
    const db = await this.open();
    return new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const req = tx.objectStore(this.storeName).get(key);
      req.onsuccess = () =>
        resolve(typeof req.result === "string" ? req.result : null);
      req.onerror = () =>
        reject(req.error ?? new Error("IndexedDB read failed."));
    });
  }

  public async write(key: string, value: string): Promise<void> {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB write failed."));
    });
  }

  public async delete(key: string): Promise<void> {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB delete failed."));
    });
  }
}