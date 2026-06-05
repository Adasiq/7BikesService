// Объединённая точка входа для Passenger (Beget, 1 сайт).
// Запускает NestJS (API + /uploads) и Next.js (сайт) в ОДНОМ процессе на одном порту:
//   /api/v1/*  и  /uploads/*   -> NestJS
//   всё остальное              -> Next.js
//
// Требует предварительной сборки: `pnpm --filter @7bs/api build` и
// `pnpm --filter @7bs/web build`.
//
// В pnpm-монорепо зависимости лежат в node_modules каждого приложения,
// поэтому резолвим их явно из соответствующих папок.
const path = require("path");

const API_DIR = path.join(__dirname, "apps", "api");
const WEB_DIR = path.join(__dirname, "apps", "web");

const { NestFactory } = require(
  require.resolve("@nestjs/core", { paths: [API_DIR] }),
);
const { ValidationPipe } = require(
  require.resolve("@nestjs/common", { paths: [API_DIR] }),
);
const nextFactory = require(require.resolve("next", { paths: [WEB_DIR] }));
const { AppModule } = require("./apps/api/dist/app.module");

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  // 1. NestJS.
  const nestApp = await NestFactory.create(AppModule);
  nestApp.setGlobalPrefix("api/v1");
  nestApp.enableCors();
  nestApp.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // 2. Next.js.
  const webApp = nextFactory({ dev: false, dir: WEB_DIR });
  await webApp.prepare();
  const handle = webApp.getRequestHandler();

  // 3. Маршрутизация на уровне Express: /api/* отдаём Nest, остальное — Next.
  //    Этот middleware ставим ПЕРВЫМ, чтобы не зависеть от порядка маршрутов Nest.
  const server = nestApp.getHttpAdapter().getInstance();
  server.use((req, res, nextFn) => {
    if (req.url.startsWith("/api/")) return nextFn();
    return handle(req, res);
  });

  await nestApp.listen(PORT);
  // eslint-disable-next-line no-console
  console.log(`7BS (API + web) listening on ${PORT}`);
}

bootstrap();
