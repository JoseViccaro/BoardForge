/**
 * WorkbenchSearchService — 4-field in-memory index + ranked search (Unit 5A).
 *
 * Owned by WorkbenchFacade. Replaces the PR 1 stub with a real search over the
 * currently loaded session: net names, component designators, and part numbers.
 *
 * A query is normalized per OWASP ASVS L2 (trim + case-fold) before matching,
 * matched per index field, and ranked by relevance (exact > prefix > substring).
 * Every hit carries its panel + board context (search R2). Pure, DOM-free, and
 * node-testable; no `src/domain` file is touched.
 */

export type SearchPanelId = "boardview" | "schematic" | "navigator";

export interface SearchHit {
  id: string;
  /** Field the query matched. */
  field: "net" | "designator" | "partNumber" | "symptom";
  /** Human-readable hit label. */
  label: string;
  /** Board the hit belongs to (panel/board context). */
  boardId: string;
  /** Panel that produced this hit (search R2 context). */
  panel: SearchPanelId;
  /** Optional canonical net name when the hit refers to a net. */
  netName?: string;
}

/** A single indexed record for the in-memory search index. */
export interface SearchIndexDoc {
  field: "net" | "designator" | "partNumber";
  /** Value to match against (kept as authored; matched case-insensitively). */
  text: string;
  panel: SearchPanelId;
  boardId: string;
  netName?: string;
}

/** Internal index entry with its pre-normalized text for matching. */
interface IndexEntry extends SearchIndexDoc {
  normalized: string;
}

export class WorkbenchSearchService {
  private entries: IndexEntry[] = [];

  constructor(docs: SearchIndexDoc[] = []) {
    this.load(docs);
  }

  /** (Re)builds the in-memory index from the given session snapshot. */
  public load(docs: SearchIndexDoc[]): void {
    this.entries = docs
      .filter((d) => d.text != null)
      .map((d) => ({ ...d, normalized: d.text.trim().toLowerCase() }));
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

  public history(): string[] {
    // Search history is recorded and persisted in unit 5B.
    return [];
  }

  private toHit(
    entry: IndexEntry,
    index: number,
    field: SearchIndexDoc["field"]
  ): SearchHit {
    return {
      id: `${field}:${index}`,
      field,
      label: entry.text,
      boardId: entry.boardId,
      panel: entry.panel,
      netName: entry.netName,
    };
  }
}
