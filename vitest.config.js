import { transformWithOxc } from "vite";
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
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
