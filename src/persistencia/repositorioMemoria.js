// Repositório em memória que cumpre a interface RepositorioReservas (ver src/aplicacional/repositorio.js).
// Os dados perdem-se quando o processo termina; serve para desenvolvimento e testes até existir o repositório PostgreSQL.
// Devolve sempre arrays novos, para quem chama não conseguir alterar o estado interno. As entidades do domínio são imutáveis.
export function criarRepositorioMemoria({ salas = [], reservas = [] } = {}) {
  const salasGuardadas = [...salas];
  const reservasGuardadas = [...reservas];

  return {
    async listarSalas() {
      return [...salasGuardadas];
    },

    async listarReservas() {
      return [...reservasGuardadas];
    },

    async listarReservasDaSala(salaId) {
      return reservasGuardadas.filter((reserva) => reserva.salaId === salaId);
    },

    async guardarReserva(reserva) {
      reservasGuardadas.push(reserva);
      return reserva;
    },
  };
}
