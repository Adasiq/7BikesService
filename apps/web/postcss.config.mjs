import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Явно указываем путь к tailwind-конфигу: Next в монорепо может искать его
// от корня репозитория и не находить apps/web/tailwind.config.ts.
const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: { config: join(here, "tailwind.config.ts") },
    autoprefixer: {},
  },
};

export default config;
