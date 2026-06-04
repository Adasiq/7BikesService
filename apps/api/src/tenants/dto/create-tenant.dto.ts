import { IsEnum, IsString, MinLength } from "class-validator";
import { TenantType } from "@prisma/client";

export class CreateTenantDto {
  @IsEnum(TenantType)
  type!: TenantType;

  @IsString()
  @MinLength(2)
  name!: string;
}
