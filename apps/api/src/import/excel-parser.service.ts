import { Injectable } from "@nestjs/common";
import { Workbook, Cell } from "exceljs";

export interface ParsedProduct {
  sku: string;
  name: string;
  price: number;
  stockQty: number;
  currency: string;
  category: string | null;
  subcategory: string | null;
  attrs: Record<string, unknown>;
}

export interface ParsedImage {
  sku: string;
  buffer: Buffer;
  ext: string;
}

export interface ParseResult {
  records: ParsedProduct[];
  images: ParsedImage[];
  stats: { scanned: number; parsed: number; skipped: number; deduped: number };
}

// Поля, которые маппятся в колонки Product напрямую; остальные идут в attrs.
const CORE_FIELDS = new Set(["sku", "name", "price", "stock"]);

@Injectable()
export class ExcelParserService {
  async parse(
    buffer: Buffer,
    template: {
      sheetName: string | null;
      headerRow: number;
      columnMapping: Record<string, unknown>;
    },
  ): Promise<ParseResult> {
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);

    const ws = template.sheetName
      ? wb.getWorksheet(template.sheetName) ?? wb.worksheets[0]
      : wb.worksheets[0];
    if (!ws) throw new Error("Лист с данными не найден");

    // Разбор маппинга: "_key" — управляющие настройки, число — колонка поля,
    // строка — мета (currency).
    const cols: Record<string, number> = {};
    const meta: Record<string, string> = {};
    const control: Record<string, number> = {};
    for (const [key, val] of Object.entries(template.columnMapping)) {
      if (key.startsWith("_")) {
        if (typeof val === "number") control[key.slice(1)] = val;
      } else if (typeof val === "number") cols[key] = val;
      else if (typeof val === "string") meta[key] = val;
    }
    const currency = meta.currency ?? "RUB";
    const categoryCol = control.categoryCol ?? 0;
    const subcategoryCol = control.subcategoryCol ?? 0;

    const bySku = new Map<string, ParsedProduct>();
    const rowToSku = new Map<number, string>();
    let scanned = 0;
    let skipped = 0;
    let deduped = 0;
    let category: string | null = null;
    let subcategory: string | null = null;

    for (let r = template.headerRow + 1; r <= ws.rowCount; r++) {
      scanned++;
      const row = ws.getRow(r);
      const read = (col: number) =>
        col ? this.cellValue(row.getCell(col)) : null;

      const skuRaw = cols.sku ? read(cols.sku) : null;
      const price = this.toNumber(cols.price ? read(cols.price) : null);

      // Не товар => кандидат в заголовок категории/подкатегории.
      if (skuRaw === null || skuRaw === "" || price === null) {
        const catVal = categoryCol ? read(categoryCol) : null;
        const subVal = subcategoryCol ? read(subcategoryCol) : null;
        if (catVal) {
          category = String(catVal);
          subcategory = null;
        } else if (subVal) {
          subcategory = String(subVal);
        }
        skipped++;
        continue;
      }

      const sku = String(skuRaw).trim();
      const name = String(read(cols.name) ?? "").trim() || sku;
      const { stockQty, stockText } = this.parseStock(read(cols.stock));

      const attrs: Record<string, unknown> = {};
      for (const [field, col] of Object.entries(cols)) {
        if (CORE_FIELDS.has(field)) continue;
        const v = read(col);
        if (v !== null && v !== "") attrs[field] = v;
      }
      if (stockText) attrs.stockText = stockText;

      const record: ParsedProduct = {
        sku,
        name,
        price,
        stockQty,
        currency,
        category,
        subcategory,
        attrs,
      };
      if (bySku.has(sku)) deduped++;
      bySku.set(sku, record);
      rowToSku.set(r, sku);
    }

    const images = this.extractImages(wb, ws, rowToSku);
    const records = [...bySku.values()];
    return {
      records,
      images,
      stats: { scanned, parsed: records.length, skipped, deduped },
    };
  }

  // Сопоставляет встроенные картинки со строками товаров (по якорю), первая на SKU.
  private extractImages(
    wb: Workbook,
    ws: unknown,
    rowToSku: Map<number, string>,
  ): ParsedImage[] {
    const media = (wb as unknown as { media?: { type: string; extension?: string; buffer?: Buffer }[] }).media ?? [];
    let anchored: { imageId: number; range?: { tl?: { nativeRow?: number } } }[] = [];
    try {
      anchored = (ws as { getImages?: () => typeof anchored }).getImages?.() ?? [];
    } catch {
      return [];
    }

    const images: ParsedImage[] = [];
    const seen = new Set<string>();
    for (const im of anchored) {
      const row1 = (im.range?.tl?.nativeRow ?? -1) + 1;
      const sku = rowToSku.get(row1);
      if (!sku || seen.has(sku)) continue;
      const m = media[im.imageId];
      if (!m || m.type !== "image" || !m.buffer) continue;
      seen.add(sku);
      images.push({ sku, buffer: m.buffer, ext: m.extension || "png" });
    }
    return images;
  }

  private cellValue(cell: Cell): string | number | null {
    let v: unknown = cell.value;
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (o.result !== undefined) v = o.result;
      else if (o.text !== undefined) v = o.text;
      else if (Array.isArray(o.richText))
        v = (o.richText as { text: string }[]).map((t) => t.text).join("");
      else v = null;
    }
    if (typeof v === "string") v = v.replace(/\s+/g, " ").trim();
    if (v === undefined) return null;
    return v as string | number | null;
  }

  private toNumber(v: unknown): number | null {
    if (v === null || v === "") return null;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(",", ".").replace(/[^\d.\-]/g, ""));
    return isNaN(n) ? null : n;
  }

  private parseStock(raw: unknown): { stockQty: number; stockText: string | null } {
    if (raw === null || raw === "") return { stockQty: 0, stockText: null };
    if (typeof raw === "number") return { stockQty: Math.trunc(raw), stockText: null };
    const s = String(raw).trim();
    const n = this.toNumber(s);
    if (n !== null && !/[<>]/.test(s)) return { stockQty: Math.trunc(n), stockText: null };
    if (/^>\s*\d+/.test(s)) {
      const base = this.toNumber(s) ?? 0;
      return { stockQty: Math.trunc(base) + 1, stockText: s };
    }
    return { stockQty: 0, stockText: s };
  }
}
