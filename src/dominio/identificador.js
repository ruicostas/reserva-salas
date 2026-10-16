// Um identificador válido é um inteiro positivo ou um texto não vazio (ex.: UUID gerado pela base de dados).
export function ehIdentificadorValido(valor) {
  if ("string" === typeof valor) {
    return "" !== valor.trim();
  }
  return Number.isInteger(valor) && valor > 0;
}
