import { join } from "path";

// Каталог статики (apps/api/uploads), независимо от cwd запуска.
// Этот файл компилируется в dist/uploads.js => __dirname = .../apps/api/dist.
export const UPLOAD_DIR = join(__dirname, "..", "uploads");

// URL-префикс, под которым раздаётся статика (см. ServeStaticModule).
export const UPLOAD_URL_PREFIX = "/uploads";
