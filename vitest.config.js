import { loadEnv, transformWithOxc } from "vite";
import { defineConfig } from "vitest/config";

// O Next aceita JSX em ficheiros .js; o Vite só o faz em .jsx/.tsx. Este plugin trata os .js de src/ como JSX nos testes.
const jsxEmFicheirosJs = {
  name: "jsx-em-ficheiros-js",
  enforce: "pre",
  transform(codigo, id) {
    if (!/[\\/]src[\\/].*\.js$/.test(id)) {
      return null;
    }
    return transformWithOxc(codigo, id, { lang: "jsx", jsx: { runtime: "automatic" } });
  },
};

export default defineConfig({
  plugins: [jsxEmFicheirosJs],
  test: {
    // Lê .env, .env.local, .env.test e .env.test.local (todas as variáveis, sem filtro de prefixo), para os testes de
    // contrato contra o PostgreSQL. Os testes unitários que dependem destas variáveis fixam os seus próprios valores.
    env: loadEnv("test", process.cwd(), ""),
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
