import { SchematicPage } from "../entities/SchematicPage.js";
import { SchematicSheet } from "../entities/SchematicSheet.js";
import { SchematicSymbol } from "../entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../entities/SchematicPinLocation.js";
import { SchematicNet } from "../entities/SchematicNet.js";
import { MultiPageSymbolAggregate } from "./MultiPageSymbolAggregate.js";
import { VectorToken } from "../value-objects/VectorToken.js";

export interface SchematicDocumentProps {
  documentId: string;
  title: string;
  pageCount?: number;
  sheetCount?: number;
}

export class SchematicDocument {
  public readonly documentId: string;
  public readonly title: string;
  public readonly pageCount: number;
  private readonly _pages: Map<number, SchematicPage | SchematicSheet> = new Map();
  private readonly _multiPageSymbols: Map<string, MultiPageSymbolAggregate> = new Map();
  private readonly _nets: Map<string, SchematicNet> = new Map();

  constructor(props: SchematicDocumentProps) {
    if (!props.documentId || props.documentId.trim().length === 0) {
      throw new Error("documentId cannot be empty");
    }
    if (!props.title || props.title.trim().length === 0) {
      throw new Error("title cannot be empty");
    }
    const count = props.sheetCount ?? props.pageCount;
    if (count === undefined || !Number.isInteger(count) || count <= 0) {
      throw new Error("pageCount must be a positive integer");
    }

    this.documentId = props.documentId.trim();
    this.title = props.title.trim();
    this.pageCount = count;
  }

  public get sheetCount(): number {
    return this.pageCount;
  }

  public get pages(): ReadonlyMap<number, SchematicPage | SchematicSheet> {
    return this._pages;
  }

  public get sheets(): ReadonlyMap<number, SchematicSheet | SchematicPage> {
    return this._pages;
  }

  public get multiPageSymbols(): ReadonlyMap<string, MultiPageSymbolAggregate> {
    return this._multiPageSymbols;
  }

  public get nets(): ReadonlyMap<string, SchematicNet> {
    return this._nets;
  }

  public addPage(page: SchematicPage | SchematicSheet): void {
    this._pages.set(page.pageNumber, page);
  }

  public addSheet(sheet: SchematicSheet | SchematicPage): void {
    this._pages.set(sheet.sheetNumber, sheet);
  }

  public getPage(pageNumber: number): (SchematicPage | SchematicSheet) | undefined {
    return this._pages.get(pageNumber);
  }

  public getSheet(sheetNumber: number): (SchematicSheet | SchematicPage) | undefined {
    return this._pages.get(sheetNumber);
  }

  public addNet(net: SchematicNet): void {
    this._nets.set(net.name.toUpperCase(), net);
  }

  public getNet(name: string): SchematicNet | undefined {
    return this._nets.get(name.trim().toUpperCase());
  }

  public registerSymbol(symbol: SchematicSymbol): void {
    const rawKey = symbol.refDes.toUpperCase();
    const baseKey = rawKey.replace(/_[A-Z0-9]+$/, "");
    const key = symbol.bankDesignator || rawKey.includes("_") ? baseKey : rawKey;

    let agg = this._multiPageSymbols.get(key);
    if (!agg) {
      agg = new MultiPageSymbolAggregate(key);
      this._multiPageSymbols.set(key, agg);
    }
    agg.addSymbolBank(symbol);
  }

  public getSymbol(refDes: string): MultiPageSymbolAggregate | undefined {
    const norm = refDes.trim().toUpperCase();
    const base = norm.replace(/_[A-Z0-9]+$/, "");
    return this._multiPageSymbols.get(norm) ?? this._multiPageSymbols.get(base);
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
