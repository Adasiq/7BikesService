import { Injectable } from "@nestjs/common";
import { Workbook, Worksheet, Cell } from "exceljs";

export interface ParsedProduct {
  sku: string;
  name: string;
  price: number;
  stockQty: number;
  currency: string;
  attrs: Record<string, unknown>;
}

export interface ParseResult {
  records: ParsedProduct[];
  stats: {
    scanned: number;
    parsed: number;
    skipped: number;
    deduped: number;
  };
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
    if (!ws) {
      throw new Error("Лист с данными не найден");
    }

    // Разделяем маппинг: числовые значения — индексы колонок, строковые — мета.
    const cols: Record<string, number> = {};
    const meta: Record<string, string> = {};
    for (const [key, val] of Object.entries(template.columnMapping)) {
      if (typeof val === "number") cols[key] = val;
      else if (typeof val === "string") meta[key] = val;
    }
    const currency = meta.currency ?? "RUB";

    const bySku = new Map<string, ParsedProduct>();
    let scanned = 0;
    let skipped = 0;
    let deduped = 0;

    for (let r = template.headerRow + 1; r <= ws.rowCount; r++) {
      scanned++;
      const row = ws.getRow(r);
      const read = (field: string) =>
        cols[field] ? this.cellValue(row.getCell(cols[field])) : null;

      const skuRaw = read("sku");
      const price = this.toNumber(read("price"));
      // Продукт = есть артикул и числовая цена. Иначе это категория/мусор.
      if (skuRaw === null || skuRaw === "" || price === null) {
        skipped++;
        continue;
      }

      const sku = String(skuRaw).trim();
      const name = String(read("name") ?? "").trim() || sku;

      const stockRaw = read("stock");
      const { stockQty, stockText } = this.parseStock(stockRaw);

      const attrs: Record<string, unknown> = {};
      for (const field of Object.keys(cols)) {
        if (CORE_FIELDS.has(field)) continue;
        const v = read(field);
        if (v !== null && v !== "") attrs[field] = v;
      }
      if (stockText) attrs.stockText = stockText;

      const record: ParsedProduct = {
        sku,
        name,
        price,
        stockQty,
        currency,
        attrs,
      };

      if (bySku.has(sku)) deduped++;
      bySku.set(sku, record); // последняя строка побеждает
    }

    const records = [...bySku.values()];
    return {
      records,
      stats: { scanned, parsed: records.length, skipped, deduped },
    };
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

  // "Остаток" бывает числом (0..10) или текстом ">10". Сохраняем оба представления.
  private parseStock(raw: unknown): { stockQty: number; stockText: string | null } {
    if (raw === null || raw === "") return { stockQty: 0, stockText: null };
    if (typeof raw === "number") return { stockQty: Math.trunc(raw), stockText: null };
    const s = String(raw).trim();
    const n = this.toNumber(s);
    if (n !== null && !/[<>]/.test(s)) return { stockQty: Math.trunc(n), stockText: null };
    // ">10" -> нижняя граница 11 + сырой текст для отображения
    if (/^>\s*\d+/.test(s)) {
      const base = this.toNumber(s) ?? 0;
      return { stockQty: Math.trunc(base) + 1, stockText: s };
    }
    return { stockQty: 0, stockText: s };
  }
}
