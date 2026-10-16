import { ErroDominio } from "../dominio/erros.js";
import { criarReserva } from "../dominio/reserva.js";
import { garantirSalaLivre } from "../dominio/sobreposicao.js";

export const CODIGOS_RESERVAR_SALA = Object.freeze({
  SALA_INEXISTENTE: "SALA_INEXISTENTE",
  ERRO_INESPERADO: "ERRO_INESPERADO",
});

/**
 * Caso de uso "Reservar sala". Nunca lança exceções: devolve { sucesso: true, reserva } ou { sucesso: false, erro: <código> }.
 * O código de erro é traduzido para texto pela apresentação.
 *
 * @param {{ repositorio: import("./repositorio.js").RepositorioReservas, gerarId?: () => string }} dependencias
 * @param {{ salaId: number | string, inicio: Date, fim: Date }} pedido
 */
export async function reservarSala({ repositorio, gerarId = () => crypto.randomUUID() }, { salaId, inicio, fim }) {
  try {
    const salas = await repositorio.listarSalas();
    if (!salas.some((sala) => sala.id === salaId)) {
      return { sucesso: false, erro: CODIGOS_RESERVAR_SALA.SALA_INEXISTENTE };
    }

    const reserva = criarReserva({ id: gerarId(), salaId, inicio, fim });
    garantirSalaLivre(reserva, await repositorio.listarReservasDaSala(salaId));

    return { sucesso: true, reserva: await repositorio.guardarReserva(reserva) };
  } catch (erro) {
    if (erro instanceof ErroDominio) {
      return { sucesso: false, erro: erro.codigo };
    }
    return { sucesso: false, erro: CODIGOS_RESERVAR_SALA.ERRO_INESPERADO };
  }
}
