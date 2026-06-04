import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get()
  root() {
    return { service: "7bs-api", status: "ok" };
  }

  @Get("health")
  health() {
    return { status: "ok", uptime: process.uptime() };
  }
}
