import { ErroDominio } from "./erros.js";
import { ehIdentificadorValido } from "./identificador.js";

export const CODIGOS_RESERVA = Object.freeze({
  ID_INVALIDO: "RESERVA_ID_INVALIDO",
  SALA_INVALIDA: "RESERVA_SALA_INVALIDA",
  DATA_INVALIDA: "RESERVA_DATA_INVALIDA",
  FIM_NAO_POSTERIOR_AO_INICIO: "RESERVA_FIM_NAO_POSTERIOR_AO_INICIO",
});

function ehDataValida(valor) {
  return valor instanceof Date && !Number.isNaN(valor.getTime());
}

// Cria uma reserva válida e imutável, ou lança ErroDominio se algum dado não cumprir as regras.
// Um Date guarda um instante absoluto (milissegundos desde 1970-01-01T00:00:00Z), por isso inicio e fim já estão em UTC;
// a conversão para a hora local é responsabilidade da apresentação.
export function criarReserva({ id, salaId, inicio, fim }) {
  if (!ehIdentificadorValido(id)) {
    throw new ErroDominio(CODIGOS_RESERVA.ID_INVALIDO);
  }
  if (!ehIdentificadorValido(salaId)) {
    throw new ErroDominio(CODIGOS_RESERVA.SALA_INVALIDA);
  }
  if (!ehDataValida(inicio) || !ehDataValida(fim)) {
    throw new ErroDominio(CODIGOS_RESERVA.DATA_INVALIDA);
  }
  if (fim.getTime() <= inicio.getTime()) {
    throw new ErroDominio(CODIGOS_RESERVA.FIM_NAO_POSTERIOR_AO_INICIO);
  }

  // Cópias das datas: quem criou a reserva não consegue alterá-la depois mexendo nos Date originais.
  return Object.freeze({ id, salaId, inicio: new Date(inicio.getTime()), fim: new Date(fim.getTime()) });
}
