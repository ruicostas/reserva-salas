export const CODIGOS_SOBREPOSICAO = Object.freeze({
  SALA_OCUPADA: "SALA_OCUPADA",
});

// Garante que a nova reserva não se sobrepõe a nenhuma reserva existente da mesma sala.
// Lança ErroDominio(SALA_OCUPADA) se houver sobreposição. Intervalos [inicio, fim): reservas seguidas são permitidas.
// Esqueleto da fase vermelha (TDD): ainda por implementar.
export function garantirSalaLivre(novaReserva, reservasExistentes) {
  throw new Error("NAO_IMPLEMENTADO");
}
