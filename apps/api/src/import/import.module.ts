import { Module } from "@nestjs/common";
import { ImportService } from "./import.service";
import { ImportController } from "./import.controller";
import { ExcelParserService } from "./excel-parser.service";

@Module({
  controllers: [ImportController],
  providers: [ImportService, ExcelParserService],
})
export class ImportModule {}
