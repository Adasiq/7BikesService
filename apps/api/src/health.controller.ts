import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  root() {
    return { service: "7bs-api", status: "ok" };
  }

  @Get("health")
  health() {
    return { status: "ok", uptime: process.uptime() };
  }

  @Get("health/db")
  async db() {
    await this.prisma.$queryRaw`SELECT 1`;
    const tenants = await this.prisma.tenant.count();
    return { status: "ok", db: "connected", tenants };
  }
}
