/**
 * WorkbenchSearchService — 4-field in-memory index + ranked search (Units
 * 5A + 5B).
 *
 * Owned by WorkbenchFacade. Replaces the PR 1 stub with a real search over the
 * currently loaded session: net names, component designators, part numbers,
 * and symptom references.
 *
 * A query is normalized per OWASP ASVS L2 (trim + case-fold) before matching,
 * matched per index field, and ranked by relevance (exact > prefix > substring).
 * Every hit carries its panel + board context (search R2). Pure, DOM-free, and
 * node-testable; no `src/domain` file is touched.
 *
 * Unit 5B adds:
 *  - a per-session search history (newest-first, deduped, capped) with a
 *    prunable/persistable slice for session restore (search R3);
 *  - symptom reference indexing that resolves a symptom term to its domain
 *    diagnostic classification — reusing the existing `EvaluationOutcome` enum,
 *    so "short to ground" maps to CRITICAL_LOW_OR_SHORT (search R4).
 */

import { EvaluationOutcome } from "../../domain/measurements/value-objects/EvaluationOutcome.js";

export { EvaluationOutcome };

export type SearchPanelId = "boardview" | "schematic" | "navigator";

/** Fields the unified index matches against (search R1 + R4 symptom). */
export type SearchIndexField = "net" | "designator" | "partNumber" | "symptom";

export interface SearchHit {
  id: string;
  /** Field the query matched. */
  field: SearchIndexField;
  /** Human-readable hit label. */
  label: string;
  /** Board the hit belongs to (panel/board context). */
  boardId: string;
  /** Panel that produced this hit (search R2 context). */
  panel: SearchPanelId;
  /** Optional canonical net name when the hit refers to a net. */
  netName?: string;
  /** Diagnostic classification for a symptom-reference hit (R4). */
  classification?: EvaluationOutcome;
}

/** A single indexed record for the in-memory search index. */
export interface SearchIndexDoc {
  field: SearchIndexField;
  /** Value to match against (kept as authored; matched case-insensitively). */
  text: string;
  panel: SearchPanelId;
  boardId: string;
  netName?: string;
  /** Diagnostic classification for symptom-reference docs (R4). */
  classification?: EvaluationOutcome;
}

/** Internal index entry with its pre-normalized text for matching. */
interface IndexEntry extends SearchIndexDoc {
  normalized: string;
}

/**
 * Default symptom → diagnostic-classification reference map (search R4).
 * Symptom terms (normalized) resolve to an `EvaluationOutcome` — the existing
 * domain value, reused rather than inventing a new classification enum.
 */
export const DEFAULT_SYMPTOM_MAP: Readonly<Record<string, EvaluationOutcome>> = {
  "short to ground": EvaluationOutcome.CRITICAL_LOW_OR_SHORT,
  "short": EvaluationOutcome.CRITICAL_LOW_OR_SHORT,
  low: EvaluationOutcome.CRITICAL_LOW_OR_SHORT,
  "no power": EvaluationOutcome.OPEN_LINE_OL,
  "open line": EvaluationOutcome.OPEN_LINE_OL,
  "unexpected high": EvaluationOutcome.UNEXPECTED_HIGH,
  deviation: EvaluationOutcome.WARNING_DEVIATION,
};

/** Default cap for the in-memory search history (newest entries retained). */
const DEFAULT_MAX_HISTORY = 20;

export class WorkbenchSearchService {
  private entries: IndexEntry[] = [];
  /** Newest-first, deduped, capped list of recorded executed queries (R3). */
  private historyList: string[] = [];
  private readonly maxHistory: number;
  private readonly symptomMap: Readonly<Record<string, EvaluationOutcome>>;

  constructor(
    docs: SearchIndexDoc[] = [],
    options: { maxHistory?: number; symptomMap?: Record<string, EvaluationOutcome> } = {}
  ) {
    this.maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY;
    this.symptomMap = options.symptomMap ?? DEFAULT_SYMPTOM_MAP;
    this.load(docs);
  }

  /** (Re)builds the in-memory index from the given session snapshot. */
  public load(docs: SearchIndexDoc[]): void {
    this.entries = docs
      .filter((d) => d.text != null)
      .map((d) => ({ ...d, normalized: d.text.trim().toLowerCase() }));
  }

  /**
   * Sanitizes a raw query per OWASP ASVS L2 (trim + case-fold). Used for both
   * search matching and history recording; raw input is never trusted verbatim.
   */
  public static normalizeQuery(raw: string): string {
    return raw.trim().toLowerCase();
  }

  /**
   * Normalized (ASVS L2) ranked search over the 4-field index.
   * Exact matches rank above prefixes, which rank above substrings.
   */
  public search(_rawQuery: string): SearchHit[] {
    const query = _rawQuery.trim().toLowerCase();
    if (query.length === 0) {
      return [];
    }

    const hits: Array<{ hit: SearchHit; score: number }> = [];
    this.entries.forEach((entry, index) => {
      const label = entry.text;
      // Exact
      if (entry.normalized === query) {
        hits.push({ hit: this.toHit(entry, index, entry.field), score: 3 });
        return;
      }
      // Prefix
      if (entry.normalized.startsWith(query)) {
        hits.push({ hit: this.toHit(entry, index, entry.field), score: 2 });
        return;
      }
      // Substring
      if (entry.normalized.includes(query)) {
        hits.push({ hit: this.toHit(entry, index, entry.field), score: 1 });
      }
    });

    hits.sort((a, b) => b.score - a.score || a.hit.id.localeCompare(b.hit.id));
    return hits.map((h) => h.hit);
  }

  // -------------------------------------------------------------------------
  // Search history (R3): newest-first, deduped, capped, session-restore slice
  // -------------------------------------------------------------------------

  /**
   * Records an executed query into history. The raw query is trimmed (ASVS L2)
   * but keeps its authored casing for display; dedupe is case-insensitive (a
   * prior occurrence of the same normalized query moves to the newest position)
   * and the list is capped at `maxHistory` entries. Empty queries are ignored.
   */
  public recordSearch(rawQuery: string): string {
    const trimmed = rawQuery.trim();
    if (trimmed.length === 0) {
      return "";
    }
    const normalized = WorkbenchSearchService.normalizeQuery(trimmed);
    const existing = this.historyList.findIndex(
      (h) => WorkbenchSearchService.normalizeQuery(h) === normalized
    );
    if (existing !== -1) {
      this.historyList.splice(existing, 1);
    }
    this.historyList.unshift(trimmed);
    if (this.historyList.length > this.maxHistory) {
      this.historyList.length = this.maxHistory;
    }
    return trimmed;
  }

  /** Newest-first snapshot of the recorded search history (R3). */
  public history(): string[] {
    return [...this.historyList];
  }

  /**
   * Returns a prunable/persistable slice (newest `limit` entries) kept in
   * newest-first order, for session persist/restore without mutating history.
   */
  public historySlice(limit = DEFAULT_MAX_HISTORY): string[] {
    return this.historyList.slice(0, limit);
  }

  /**
   * Restores history from a persisted (newest-first) slice. Trims each entry
   * (ASVS L2), drops empties/case-insensitive duplicates, and preserves the
   * slice order and authored casing.
   */
  public restoreHistory(slice: string[]): void {
    const seen = new Set<string>();
    const restored: string[] = [];
    for (const raw of slice) {
      const trimmed = raw.trim();
      const normalized = WorkbenchSearchService.normalizeQuery(trimmed);
      if (trimmed.length === 0 || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      restored.push(trimmed);
      if (restored.length >= this.maxHistory) {
        break;
      }
    }
    this.historyList = restored;
  }

  // -------------------------------------------------------------------------
  // Symptom reference mapping (R4)
  // -------------------------------------------------------------------------

  /**
   * Resolves a symptom term (e.g. "short to ground") to its domain diagnostic
   * classification, reusing the existing `EvaluationOutcome` value. Returns
   * undefined when the term has no recorded classification (no-op).
   */
  public classifySymptom(rawTerm: string): EvaluationOutcome | undefined {
    const term = WorkbenchSearchService.normalizeQuery(rawTerm);
    if (term.length === 0) {
      return undefined;
    }
    return this.symptomMap[term];
  }

  private toHit(
    entry: IndexEntry,
    index: number,
    field: SearchIndexField
  ): SearchHit {
    return {
      id: `${field}:${index}`,
      field,
      label: entry.text,
      boardId: entry.boardId,
      panel: entry.panel,
      netName: entry.netName,
      classification: entry.classification,
    };
  }
}
