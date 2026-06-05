import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Prisma, ImportBatchStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  ExcelParserService,
  ParsedProduct,
  ParsedImage,
} from "./excel-parser.service";

function extToMime(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

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

      const { deactivated, imagesSaved } = await this.persist(
        supplierId,
        batch.id,
        records,
        images,
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
            images: imagesSaved,
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

  // Полный снимок каталога: create/update товаров + картинки в БД.
  private async persist(
    supplierId: string,
    batchId: string,
    records: ParsedProduct[],
    images: ParsedImage[],
  ): Promise<{ deactivated: number; imagesSaved: number }> {
    const existing = await this.prisma.product.findMany({
      where: { supplierId },
      select: { id: true, sku: true },
    });
    const skuToId = new Map(existing.map((p) => [p.sku, p.id]));
    const existingSkus = new Set(skuToId.keys());
    const hasImage = new Set(images.map((i) => i.sku));

    // Назначаем id новым товарам заранее — чтобы построить ссылку на картинку.
    const toCreate: { id: string; r: ParsedProduct }[] = [];
    const toUpdate: { id: string; r: ParsedProduct }[] = [];
    for (const r of records) {
      const existingId = skuToId.get(r.sku);
      if (existingId) {
        toUpdate.push({ id: existingId, r });
      } else {
        const id = randomUUID();
        skuToId.set(r.sku, id);
        toCreate.push({ id, r });
      }
    }

    const data = (id: string, r: ParsedProduct) => ({
      name: r.name,
      price: new Prisma.Decimal(r.price),
      currency: r.currency,
      stockQty: r.stockQty,
      category: r.category,
      subcategory: r.subcategory,
      imageUrl: hasImage.has(r.sku)
        ? `/api/v1/catalog/products/${id}/image`
        : null,
      attrs: r.attrs as Prisma.InputJsonValue,
      importBatchId: batchId,
      isActive: true,
    });

    const CHUNK = 1000;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      await this.prisma.product.createMany({
        data: toCreate
          .slice(i, i + CHUNK)
          .map(({ id, r }) => ({ id, supplierId, sku: r.sku, ...data(id, r) })),
      });
    }

    const CONC = 25;
    for (let i = 0; i < toUpdate.length; i += CONC) {
      await Promise.all(
        toUpdate.slice(i, i + CONC).map(({ id, r }) =>
          this.prisma.product.update({
            where: { supplierId_sku: { supplierId, sku: r.sku } },
            data: data(id, r),
          }),
        ),
      );
    }

    // Картинки: перезаписываем для затронутых товаров (delete + createMany).
    const imageRows: Prisma.ProductImageCreateManyInput[] = [];
    for (const im of images) {
      const productId = skuToId.get(im.sku);
      if (!productId) continue;
      imageRows.push({
        productId,
        data: Uint8Array.from(im.buffer),
        mime: extToMime(im.ext),
      });
    }

    const ids = imageRows.map((x) => x.productId as string);
    for (let i = 0; i < ids.length; i += CHUNK) {
      await this.prisma.productImage.deleteMany({
        where: { productId: { in: ids.slice(i, i + CHUNK) } },
      });
    }
    const IMG_CHUNK = 400;
    for (let i = 0; i < imageRows.length; i += IMG_CHUNK) {
      await this.prisma.productImage.createMany({
        data: imageRows.slice(i, i + IMG_CHUNK),
      });
    }

    const seenSkus = records.map((r) => r.sku);
    const { count } = await this.prisma.product.updateMany({
      where: { supplierId, sku: { notIn: seenSkus }, isActive: true },
      data: { isActive: false },
    });

    return { deactivated: count, imagesSaved: imageRows.length };
  }
}
