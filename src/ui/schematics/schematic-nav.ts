/**
 * Page-navigation core — pure DOM/React-free navigation state.
 *
 * Answers two navigation concerns for the schematic panel (schematics R3):
 *
 * 1. `jumpToRefDes` — lower the panel onto a component's first page and tell
 *    it the full ordered page list so it can render the page-list chip row
 *    (e.g. jump to U2700 → page 12, list [12, 13, 14]).
 * 2. `SchematicNavigator` — unbounded-safe next/previous/jump across the
 *    document's page count, clamping at the first and last page.
 *
 * No lookup state is owned here beyond the navigator's current page; the
 * document's page count is injected so the core stays a pure value.
 */
import type { MultiPageSymbolAggregate } from "../../domain/schematics/aggregates/MultiPageSymbolAggregate.js";

// ---------------------------------------------------------------------------
// jumpToRefDes — lower onto a multi-page component
// ---------------------------------------------------------------------------

/** Result of lowering the panel onto a component. */
export interface JumpResult {
  /** The page to display — the component's first (lowest) page. */
  pageNumber: number;
  /** All pages the component spans, ascending and deduped. */
  pageList: number[];
}

/**
 * Resolve where the panel should go when the user jumps to a component.
 *
 * The target page is the component's first page (its aggregate returns pages
 * sorted ascending), and the page list is the full set of pages it spans so
 * the panel can render the "pages" chip row for the aggregate.
 *
 * Returns the aggregate's first page / full list — never throws.
 */
export function jumpToRefDes(aggregate: MultiPageSymbolAggregate): JumpResult {
  const pageList = aggregate.getAllPages();
  return { pageNumber: pageList[0], pageList };
}

// ---------------------------------------------------------------------------
// SchematicNavigator — next/previous/jump with document bounds
// ---------------------------------------------------------------------------

/**
 * Minimal page cursor over a document's page count.
 *
 * `next`, `previous` and `jumpTo` return the resulting current page and clamp
 * to `[1, totalPages]`, so the caller can render a single direction without
 * worrying about running off either end.
 */
export class SchematicNavigator {
  public readonly totalPages: number;
  private _currentPage: number;

  constructor(totalPages: number, initialPage = 1) {
    if (!Number.isInteger(totalPages) || totalPages <= 0) {
      throw new Error("totalPages must be a positive integer");
    }
    this.totalPages = totalPages;
    this._currentPage = this.clamp(initialPage);
  }

  public get currentPage(): number {
    return this._currentPage;
  }

  public get hasNext(): boolean {
    return this._currentPage < this.totalPages;
  }

  public get hasPrevious(): boolean {
    return this._currentPage > 1;
  }

  /** Advance one page; clamping at the document's last page. */
  public next(): number {
    this._currentPage = Math.min(this._currentPage + 1, this.totalPages);
    return this._currentPage;
  }

  /** Step back one page; clamping at the document's first page. */
  public previous(): number {
    this._currentPage = Math.max(this._currentPage - 1, 1);
    return this._currentPage;
  }

  /** Jump to an absolute page, clamping into `[1, totalPages]`. */
  public jumpTo(pageNumber: number): number {
    this._currentPage = this.clamp(pageNumber);
    return this._currentPage;
  }

  private clamp(pageNumber: number): number {
    if (!Number.isFinite(pageNumber)) {
      return 1;
    }
    return Math.max(1, Math.min(Math.trunc(pageNumber), this.totalPages));
  }
}
