import { ErroDominio } from "./erros.js";

export const CODIGOS_CAPACIDADE = Object.freeze({
  CAPACIDADE_EXCEDIDA: "CAPACIDADE_EXCEDIDA",
  SALA_DIFERENTE: "CAPACIDADE_SALA_DIFERENTE",
});

// Garante que a reserva não leva mais pessoas do que a sala comporta. Devolve a reserva se cumprir a regra.
// A capacidade é o número máximo de pessoas na sala ao mesmo tempo; a reserva ocupa a sala inteira, não lugares.
export function garantirCapacidade(sala, reserva) {
  if (sala.id !== reserva.salaId) {
    throw new ErroDominio(CODIGOS_CAPACIDADE.SALA_DIFERENTE, `sala ${sala.id}, reserva da sala ${reserva.salaId}`);
  }
  if (reserva.numeroPessoas > sala.capacidade) {
    throw new ErroDominio(CODIGOS_CAPACIDADE.CAPACIDADE_EXCEDIDA, `${reserva.numeroPessoas} pessoas, capacidade ${sala.capacidade}`);
  }
  return reserva;
}
