import { ErroDominio } from "./erros.js";

export const CODIGOS_SOBREPOSICAO = Object.freeze({
  SALA_OCUPADA: "SALA_OCUPADA",
});

// Intervalos [inicio, fim): o fim de uma reserva é o instante em que a sala fica livre, por isso reservas seguidas não se sobrepõem.
function seSobrepoem(a, b) {
  return a.salaId === b.salaId && a.inicio.getTime() < b.fim.getTime() && b.inicio.getTime() < a.fim.getTime();
}

// Devolve a nova reserva se a sala estiver livre; lança ErroDominio(SALA_OCUPADA) se houver sobreposição.
export function garantirSalaLivre(novaReserva, reservasExistentes) {
  const conflito = reservasExistentes.find((existente) => seSobrepoem(novaReserva, existente));
  if (conflito) {
    throw new ErroDominio(CODIGOS_SOBREPOSICAO.SALA_OCUPADA, `conflito com a reserva ${conflito.id}`);
  }
  return novaReserva;
}
