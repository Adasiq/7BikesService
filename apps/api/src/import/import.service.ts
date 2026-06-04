import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { promises as fs } from "fs";
import { join } from "path";
import { Prisma, ImportBatchStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  ExcelParserService,
  ParsedProduct,
  ParsedImage,
} from "./excel-parser.service";
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from "../uploads";

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ExcelParserService,
  ) {}

  listTemplates(supplierId: string) {
    return this.prisma.importTemplate.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
    });
  }

  listBatches(supplierId: string) {
    return this.prisma.importBatch.findMany({
      where: { supplierId },
      orderBy: { importedAt: "desc" },
      take: 50,
    });
  }

  async getBatch(supplierId: string, id: string) {
    const batch = await this.prisma.importBatch.findFirst({
      where: { id, supplierId },
    });
    if (!batch) throw new NotFoundException("Batch not found");
    return batch;
  }

  async importForSupplier(
    supplierId: string,
    file: { originalname: string; buffer: Buffer } | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Файл не получен");
    }

    const template = await this.prisma.importTemplate.findFirst({
      where: { supplierId },
      orderBy: { createdAt: "asc" },
    });
    if (!template) {
      throw new BadRequestException(
        "Для поставщика не настроен шаблон импорта (ImportTemplate)",
      );
    }

    const batch = await this.prisma.importBatch.create({
      data: {
        supplierId,
        templateId: template.id,
        fileRef: `upload:${file.originalname}`,
        status: ImportBatchStatus.PROCESSING,
      },
    });

    try {
      const { records, images, stats } = await this.parser.parse(file.buffer, {
        sheetName: template.sheetName,
        headerRow: template.headerRow,
        columnMapping: template.columnMapping as Record<string, unknown>,
      });

      const imageUrls = await this.saveImages(supplierId, images);
      const deactivated = await this.persist(
        supplierId,
        batch.id,
        records,
        imageUrls,
      );

      return this.prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: ImportBatchStatus.COMPLETED,
          rowsOk: stats.parsed,
          rowsErr: stats.skipped,
          errorLog: {
            scanned: stats.scanned,
            deduped: stats.deduped,
            deactivated,
            images: imageUrls.size,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      await this.prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: ImportBatchStatus.FAILED,
          errorLog: {
            message: e instanceof Error ? e.message : String(e),
          } as Prisma.InputJsonValue,
        },
      });
      throw e;
    }
  }

  // Сохраняет картинки на диск, возвращает map sku -> публичный URL.
  private async saveImages(
    supplierId: string,
    images: ParsedImage[],
  ): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (!images.length) return urls;

    const dir = join(UPLOAD_DIR, "products", supplierId);
    await fs.mkdir(dir, { recursive: true });

    const CHUNK = 50;
    for (let i = 0; i < images.length; i += CHUNK) {
      const slice = images.slice(i, i + CHUNK);
      await Promise.all(
        slice.map(async (img) => {
          const safeSku = img.sku.replace(/[^a-zA-Z0-9_-]/g, "_");
          const fileName = `${safeSku}.${img.ext}`;
          await fs.writeFile(join(dir, fileName), img.buffer);
          urls.set(
            img.sku,
            `${UPLOAD_URL_PREFIX}/products/${supplierId}/${fileName}`,
          );
        }),
      );
    }
    return urls;
  }

  // Полный снимок каталога: create новых, update существующих, деактивация исчезнувших.
  private async persist(
    supplierId: string,
    batchId: string,
    records: ParsedProduct[],
    imageUrls: Map<string, string>,
  ): Promise<number> {
    const existing = await this.prisma.product.findMany({
      where: { supplierId },
      select: { sku: true },
    });
    const existingSkus = new Set(existing.map((p) => p.sku));

    const data = (r: ParsedProduct) => ({
      name: r.name,
      price: new Prisma.Decimal(r.price),
      currency: r.currency,
      stockQty: r.stockQty,
      category: r.category,
      subcategory: r.subcategory,
      imageUrl: imageUrls.get(r.sku) ?? null,
      attrs: r.attrs as Prisma.InputJsonValue,
      importBatchId: batchId,
      isActive: true,
    });

    const toCreate = records.filter((r) => !existingSkus.has(r.sku));
    const toUpdate = records.filter((r) => existingSkus.has(r.sku));

    const CHUNK = 1000;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      await this.prisma.product.createMany({
        data: toCreate
          .slice(i, i + CHUNK)
          .map((r) => ({ supplierId, sku: r.sku, ...data(r) })),
      });
    }

    const CONC = 25;
    for (let i = 0; i < toUpdate.length; i += CONC) {
      await Promise.all(
        toUpdate.slice(i, i + CONC).map((r) =>
          this.prisma.product.update({
            where: { supplierId_sku: { supplierId, sku: r.sku } },
            data: data(r),
          }),
        ),
      );
    }

    const seenSkus = records.map((r) => r.sku);
    const { count } = await this.prisma.product.updateMany({
      where: { supplierId, sku: { notIn: seenSkus }, isActive: true },
      data: { isActive: false },
    });
    return count;
  }
}
