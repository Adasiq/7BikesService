import type { Config } from "tailwindcss";
import { join } from "path";

// Абсолютные пути от каталога конфига: в монорепо Next запускает PostCSS
// из корня репозитория, и относительные globs (./app) не находят файлы.
const here = __dirname;

const config: Config = {
  content: [
    join(here, "app/**/*.{ts,tsx}"),
    join(here, "components/**/*.{ts,tsx}"),
    join(here, "lib/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
