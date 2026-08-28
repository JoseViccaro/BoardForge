/**
 * WorkbenchSearchService — STUB (PR 1 Platform Foundation).
 *
 * Owned by WorkbenchFacade so the composition contract is stable from PR 1.
 * The full four-field in-memory index (net, designator, partNumber, symptom),
 * ranking, and session history land in PR 5 (search + net navigator).
 */
export interface SearchHit {
  id: string;
  /** Field the query matched. */
  field: "net" | "designator" | "partNumber" | "symptom";
  /** Human-readable hit label. */
  label: string;
  /** Board the hit belongs to (panel/board context). */
  boardId: string;
  /** Optional canonical net name when the hit refers to a net. */
  netName?: string;
}

export class WorkbenchSearchService {
  public search(_query: string): SearchHit[] {
    // Stub: no session index built yet (PR 5 implements the real search).
    return [];
  }

  public history(): string[] {
    // Stub: history is recorded and persisted in PR 5.
    return [];
  }
}