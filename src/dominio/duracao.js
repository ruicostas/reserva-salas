import { ErroDominio } from "./erros.js";

export const CODIGOS_DURACAO = Object.freeze({
  DURACAO_MAXIMA_EXCEDIDA: "RESERVA_DURACAO_MAXIMA_EXCEDIDA",
});

const DURACAO_MAXIMA_MS = 2 * 60 * 60 * 1000;

// Garante que a reserva dura no máximo 2 horas. Devolve a reserva se cumprir a regra; lança ErroDominio se não cumprir.
// A duração é tempo real decorrido (fim − início), por isso não depende do fuso horário nem das mudanças de hora.
export function garantirDuracaoMaxima(reserva) {
  const duracaoMs = reserva.fim.getTime() - reserva.inicio.getTime();
  if (duracaoMs > DURACAO_MAXIMA_MS) {
    throw new ErroDominio(CODIGOS_DURACAO.DURACAO_MAXIMA_EXCEDIDA, `${duracaoMs / 60000} minutos`);
  }
  return reserva;
}
