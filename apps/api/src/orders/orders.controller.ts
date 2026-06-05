import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { OrderStatus, UserRole } from "@prisma/client";
import { OrdersService } from "./orders.service";
import { CheckoutDto } from "./dto/checkout.dto";
import { UpdateOrderStatusDto } from "./dto/update-status.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequestUser } from "../auth/jwt.types";

const SUPPLIER_ROLES: UserRole[] = [
  UserRole.SUPPLIER_ADMIN,
  UserRole.SUPPLIER_STAFF,
];

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post("checkout")
  @Roles(UserRole.MECHANIC, UserRole.WORKSHOP_ADMIN)
  checkout(@CurrentUser() user: RequestUser, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(user.tenantId!, user.sub, dto.items);
  }

  @Get()
  @Roles(
    UserRole.MECHANIC,
    UserRole.WORKSHOP_ADMIN,
    UserRole.SUPPLIER_ADMIN,
    UserRole.SUPPLIER_STAFF,
  )
  list(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: OrderStatus,
  ) {
    return SUPPLIER_ROLES.includes(user.role)
      ? this.ordersService.listForSupplier(user.tenantId!, status)
      : this.ordersService.listForWorkshop(user.tenantId!, status);
  }

  @Get(":id")
  @Roles(
    UserRole.MECHANIC,
    UserRole.WORKSHOP_ADMIN,
    UserRole.SUPPLIER_ADMIN,
    UserRole.SUPPLIER_STAFF,
  )
  getOne(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.ordersService.getOne(id, user.tenantId!);
  }

  @Patch(":id/status")
  @Roles(UserRole.SUPPLIER_ADMIN, UserRole.SUPPLIER_STAFF)
  updateStatus(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, user.tenantId!, dto.status);
  }
}
