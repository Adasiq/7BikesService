import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrderStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CheckoutItemDto } from "./dto/checkout.dto";

// Разрешённые переходы статуса заказа (управляет поставщик).
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  ACCEPTED: [OrderStatus.ASSEMBLED, OrderStatus.CANCELLED],
  ASSEMBLED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [],
  CANCELLED: [],
};

const ORDER_INCLUDE = {
  items: true,
  supplier: { select: { id: true, name: true } },
  workshop: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // Корзина мастера -> разбивка по поставщикам -> по заказу на поставщика.
  async checkout(
    workshopId: string,
    userId: string,
    items: CheckoutItemDto[],
  ) {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Группируем позиции по поставщику.
    const bySupplier = new Map<
      string,
      { product: (typeof products)[number]; qty: number; workOrderId?: string }[]
    >();
    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Товар не найден: ${item.productId}`);
      }
      const list = bySupplier.get(product.supplierId) ?? [];
      list.push({ product, qty: item.qty, workOrderId: item.workOrderId });
      bySupplier.set(product.supplierId, list);
    }

    // Создаём заказы атомарно.
    const created = await this.prisma.$transaction(
      [...bySupplier.entries()].map(([supplierId, list]) =>
        this.prisma.order.create({
          data: {
            workshopId,
            supplierId,
            createdById: userId,
            status: OrderStatus.NEW,
            items: {
              create: list.map((l) => ({
                productId: l.product.id,
                qty: l.qty,
                workOrderId: l.workOrderId,
                priceSnapshot: l.product.price,
                nameSnapshot: l.product.name,
                skuSnapshot: l.product.sku,
              })),
            },
          },
          include: ORDER_INCLUDE,
        }),
      ),
    );

    return { orders: created };
  }

  listForWorkshop(workshopId: string, status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: { workshopId, ...(status ? { status } : {}) },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  listForSupplier(supplierId: string, status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: { supplierId, ...(status ? { status } : {}) },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(id: string, tenantId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (
      !order ||
      (order.workshopId !== tenantId && order.supplierId !== tenantId)
    ) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  async updateStatus(id: string, supplierId: string, next: OrderStatus) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || order.supplierId !== supplierId) {
      throw new NotFoundException("Order not found");
    }
    const allowed = TRANSITIONS[order.status];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Недопустимый переход статуса: ${order.status} -> ${next}`,
      );
    }
    return this.prisma.order.update({
      where: { id },
      data: { status: next },
      include: ORDER_INCLUDE,
    });
  }
}
