import { ErroDominio } from "./erros.js";
import { ehIdentificadorValido } from "./identificador.js";

export const CODIGOS_SALA = Object.freeze({
  ID_INVALIDO: "SALA_ID_INVALIDO",
  NOME_INVALIDO: "SALA_NOME_INVALIDO",
  CAPACIDADE_INVALIDA: "SALA_CAPACIDADE_INVALIDA",
});

// Cria uma sala válida e imutável, ou lança ErroDominio se algum dado não cumprir as regras.
export function criarSala({ id, nome, capacidade }) {
  if (!ehIdentificadorValido(id)) {
    throw new ErroDominio(CODIGOS_SALA.ID_INVALIDO);
  }
  if ("string" !== typeof nome || "" === nome.trim()) {
    throw new ErroDominio(CODIGOS_SALA.NOME_INVALIDO);
  }
  if (!Number.isInteger(capacidade) || capacidade < 1) {
    throw new ErroDominio(CODIGOS_SALA.CAPACIDADE_INVALIDA, String(capacidade));
  }

  return Object.freeze({ id, nome: nome.trim(), capacidade });
}
