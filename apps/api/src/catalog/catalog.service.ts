import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface ListParams {
  search?: string;
  supplierId?: string;
  category?: string;
  page: number;
  limit: number;
  forceSupplierId?: string | null;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private scopeWhere(
    forceSupplierId?: string | null,
    supplierId?: string,
  ): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = { isActive: true };
    const sid = forceSupplierId ?? supplierId;
    if (sid) where.supplierId = sid;
    return where;
  }

  async list(params: ListParams) {
    const { search, category, page, limit } = params;
    const where = this.scopeWhere(params.forceSupplierId, params.supplierId);

    if (category) where.category = category;
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // Список категорий с количеством товаров (для навигации каталога).
  async categories(forceSupplierId?: string | null, supplierId?: string) {
    const where = this.scopeWhere(forceSupplierId, supplierId);
    const groups = await this.prisma.product.groupBy({
      by: ["category"],
      where,
      _count: { _all: true },
      orderBy: { category: "asc" },
    });
    return groups
      .filter((g) => g.category)
      .map((g) => ({ category: g.category as string, count: g._count._all }));
  }

  async getImage(id: string) {
    const img = await this.prisma.productImage.findUnique({
      where: { productId: id },
    });
    if (!img) throw new NotFoundException("Image not found");
    return img;
  }

  async getOne(id: string, forceSupplierId?: string | null) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (
      !product ||
      (forceSupplierId && product.supplierId !== forceSupplierId)
    ) {
      throw new NotFoundException("Product not found");
    }
    return product;
  }
}
