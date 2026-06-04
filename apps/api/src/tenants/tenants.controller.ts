import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { TenantType, UserRole } from "@prisma/client";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { CreateTenantAdminDto } from "./dto/create-tenant-admin.dto";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("tenants")
@Roles(UserRole.SUPER_ADMIN)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  findAll(@Query("type") type?: TenantType) {
    return this.tenantsService.findAll(type);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post(":id/admins")
  createAdmin(@Param("id") id: string, @Body() dto: CreateTenantAdminDto) {
    return this.tenantsService.createAdmin(id, dto);
  }
}
