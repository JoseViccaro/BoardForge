import { SchematicPage } from "../entities/SchematicPage.js";
import { SchematicSymbol } from "../entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../entities/SchematicPinLocation.js";
import { MultiPageSymbolAggregate } from "./MultiPageSymbolAggregate.js";
import { VectorToken } from "../value-objects/VectorToken.js";

export interface SchematicDocumentProps {
  documentId: string;
  title: string;
  pageCount: number;
}

export class SchematicDocument {
  public readonly documentId: string;
  public readonly title: string;
  public readonly pageCount: number;
  private readonly _pages: Map<number, SchematicPage> = new Map();
  private readonly _multiPageSymbols: Map<string, MultiPageSymbolAggregate> = new Map();

  constructor(props: SchematicDocumentProps) {
    if (!props.documentId || props.documentId.trim().length === 0) {
      throw new Error("documentId cannot be empty");
    }
    if (!props.title || props.title.trim().length === 0) {
      throw new Error("title cannot be empty");
    }
    if (!Number.isInteger(props.pageCount) || props.pageCount <= 0) {
      throw new Error("pageCount must be a positive integer");
    }

    this.documentId = props.documentId.trim();
    this.title = props.title.trim();
    this.pageCount = props.pageCount;
  }

  public get pages(): ReadonlyMap<number, SchematicPage> {
    return this._pages;
  }

  public get multiPageSymbols(): ReadonlyMap<string, MultiPageSymbolAggregate> {
    return this._multiPageSymbols;
  }

  public addPage(page: SchematicPage): void {
    this._pages.set(page.pageNumber, page);
  }

  public getPage(pageNumber: number): SchematicPage | undefined {
    return this._pages.get(pageNumber);
  }

  public registerSymbol(symbol: SchematicSymbol): void {
    const key = symbol.refDes.toUpperCase();
    let agg = this._multiPageSymbols.get(key);
    if (!agg) {
      agg = new MultiPageSymbolAggregate(symbol.refDes);
      this._multiPageSymbols.set(key, agg);
    }
    agg.addSymbolBank(symbol);
  }

  public getSymbol(refDes: string): MultiPageSymbolAggregate | undefined {
    return this._multiPageSymbols.get(refDes.trim().toUpperCase());
  }

  public findPinsForRefDes(refDes: string): SchematicPinLocation[] {
    const agg = this.getSymbol(refDes);
    return agg ? agg.getAllPins() : [];
  }

  public searchTokens(query: string, caseSensitive: boolean = true): VectorToken[] {
    const results: VectorToken[] = [];
    const target = caseSensitive ? query : query.toUpperCase();

    for (const page of this._pages.values()) {
      for (const token of page.tokens) {
        const text = caseSensitive ? token.text : token.text.toUpperCase();
        if (text.includes(target)) {
          results.push(token);
        }
      }
    }
    return results;
  }
}
