/**
 * Interface do repositório de que os casos de uso precisam.
 * Os casos de uso recebem um objeto com estes métodos; quem o cria (persistência) fica fora desta camada.
 * Todos os métodos são assíncronos, para um repositório de base de dados encaixar sem mudar os casos de uso.
 *
 * @typedef {object} RepositorioReservas
 * @property {() => Promise<object[]>} listarSalas Todas as salas (entidades Sala do domínio).
 * @property {() => Promise<object[]>} listarReservas Todas as reservas (entidades Reserva do domínio).
 * @property {(salaId: number | string) => Promise<object[]>} listarReservasDaSala As reservas de uma sala.
 * @property {(reserva: object) => Promise<object>} guardarReserva Guarda a reserva e devolve-a.
 */

export const METODOS_REPOSITORIO = Object.freeze(["listarSalas", "listarReservas", "listarReservasDaSala", "guardarReserva"]);
