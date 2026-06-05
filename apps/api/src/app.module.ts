import { join } from "path";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { UPLOAD_DIR, UPLOAD_URL_PREFIX } from "./uploads";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { TenantsModule } from "./tenants/tenants.module";
import { ImportModule } from "./import/import.module";
import { CatalogModule } from "./catalog/catalog.module";
import { OrdersModule } from "./orders/orders.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { RolesGuard } from "./auth/guards/roles.guard";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    // envFilePath не зависит от cwd: .env лежит рядом с собранным кодом
    // (apps/api/.env), куда бы ни запускали (root или apps/api).
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, "..", ".env"), ".env"],
    }),
    ServeStaticModule.forRoot({
      rootPath: UPLOAD_DIR,
      serveRoot: UPLOAD_URL_PREFIX,
    }),
    PrismaModule,
    AuthModule,
    TenantsModule,
    ImportModule,
    CatalogModule,
    OrdersModule,
  ],
  controllers: [HealthController],
  providers: [
    // Порядок важен: сначала аутентификация, затем проверка ролей.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
