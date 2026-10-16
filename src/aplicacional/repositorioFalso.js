import { vi } from "vitest";

// Só para testes: persistência simulada que cumpre a interface RepositorioReservas, com métodos espiáveis (vi.fn).
export function criarRepositorioFalso({ salas = [], reservas = [] } = {}) {
  const guardadas = [...reservas];
  return {
    listarSalas: vi.fn(async () => [...salas]),
    listarReservas: vi.fn(async () => [...guardadas]),
    listarReservasDaSala: vi.fn(async (salaId) => guardadas.filter((reserva) => reserva.salaId === salaId)),
    guardarReserva: vi.fn(async (reserva) => {
      guardadas.push(reserva);
      return reserva;
    }),
  };
}
