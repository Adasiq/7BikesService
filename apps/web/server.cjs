// Точка входа для Phusion Passenger (Beget) — запускает собранный Next.js.
// Passenger передаёт порт/сокет через process.env.PORT.
// Перед запуском должен быть выполнен `next build` (каталог .next).
const { createServer } = require("http");
const next = require("next");

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`7BS web listening on ${port}`);
  });
});
