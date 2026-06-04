import { Controller, Get, Param, Query } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CatalogService } from "./catalog.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequestUser } from "../auth/jwt.types";

const SUPPLIER_ROLES: UserRole[] = [
  UserRole.SUPPLIER_ADMIN,
  UserRole.SUPPLIER_STAFF,
];

@Controller("catalog")
@Roles(
  UserRole.MECHANIC,
  UserRole.WORKSHOP_ADMIN,
  UserRole.SUPPLIER_ADMIN,
  UserRole.SUPPLIER_STAFF,
)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("products")
  list(
    @CurrentUser() user: RequestUser,
    @Query("search") search?: string,
    @Query("supplierId") supplierId?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "20",
  ) {
    return this.catalogService.list({
      search,
      supplierId,
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
      forceSupplierId: this.supplierScope(user),
    });
  }

  @Get("products/:id")
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.catalogService.getOne(id, this.supplierScope(user));
  }

  // Поставщик видит только свой каталог; мастерская — все активные товары.
  private supplierScope(user: RequestUser): string | null {
    return SUPPLIER_ROLES.includes(user.role) ? user.tenantId : null;
  }
}
