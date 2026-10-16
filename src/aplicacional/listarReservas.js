/**
 * Caso de uso "Listar reservas": todas as reservas, ordenadas por início, com o nome da sala para a apresentação mostrar.
 * Se a sala de uma reserva já não existir, nomeSala fica null.
 *
 * @param {{ repositorio: import("./repositorio.js").RepositorioReservas }} dependencias
 */
export async function listarReservas({ repositorio }) {
  const [reservas, salas] = await Promise.all([repositorio.listarReservas(), repositorio.listarSalas()]);
  const nomePorSala = new Map(salas.map((sala) => [sala.id, sala.nome]));

  return [...reservas]
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .map(({ id, salaId, inicio, fim, numeroPessoas }) => ({ id, salaId, nomeSala: nomePorSala.get(salaId) ?? null, numeroPessoas, inicio, fim }));
}
