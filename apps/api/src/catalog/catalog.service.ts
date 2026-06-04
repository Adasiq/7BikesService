import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

interface ListParams {
  search?: string;
  supplierId?: string;
  page: number;
  limit: number;
  // принудительный скоуп поставщика (для ролей поставщика)
  forceSupplierId?: string | null;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListParams) {
    const { search, page, limit } = params;
    const supplierId = params.forceSupplierId ?? params.supplierId;

    const where: Prisma.ProductWhereInput = { isActive: true };
    if (supplierId) where.supplierId = supplierId;
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
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit };
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
