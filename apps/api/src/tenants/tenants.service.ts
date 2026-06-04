import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TenantType, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { CreateTenantAdminDto } from "./dto/create-tenant-admin.dto";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTenantDto) {
    return this.prisma.tenant.create({ data: dto });
  }

  findAll(type?: TenantType) {
    return this.prisma.tenant.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException("Tenant not found");
    }
    return tenant;
  }

  async createAdmin(tenantId: string, dto: CreateTenantAdminDto) {
    const tenant = await this.findOne(tenantId);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("Email already in use");
    }

    const role =
      tenant.type === TenantType.SUPPLIER
        ? UserRole.SUPPLIER_ADMIN
        : UserRole.WORKSHOP_ADMIN;

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        role,
        tenantId,
      },
    });

    // Не возвращаем хэш пароля наружу.
    const { passwordHash: _omit, ...safe } = user;
    return safe;
  }
}
