import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { ImportService } from "./import.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequestUser } from "../auth/jwt.types";

@Controller("import")
@Roles(UserRole.SUPPLIER_ADMIN, UserRole.SUPPLIER_STAFF)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get("templates")
  templates(@CurrentUser() user: RequestUser) {
    return this.importService.listTemplates(user.tenantId!);
  }

  @Get("batches")
  batches(@CurrentUser() user: RequestUser) {
    return this.importService.listBatches(user.tenantId!);
  }

  @Get("batches/:id")
  batch(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.importService.getBatch(user.tenantId!, id);
  }

  @Post("batches")
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: { originalname: string; buffer: Buffer },
  ) {
    return this.importService.importForSupplier(user.tenantId!, file);
  }
}
