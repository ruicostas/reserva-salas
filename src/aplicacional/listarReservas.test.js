import { describe, expect, it } from "vitest";
import { criarReserva } from "../dominio/reserva.js";
import { criarSala } from "../dominio/sala.js";
import { listarReservas } from "./listarReservas.js";
import { criarRepositorioFalso } from "./repositorioFalso.js";

const ATLANTICO = criarSala({ id: 1, nome: "Sala Atlântico", capacidade: 12 });
const DOURO = criarSala({ id: 2, nome: "Sala Douro", capacidade: 6 });

function reserva(id, salaId, inicio, fim) {
  return criarReserva({ id, salaId, inicio: new Date(inicio), fim: new Date(fim), numeroPessoas: 2 });
}

describe("listarReservas", () => {
  it("devolve as reservas ordenadas por início, com o nome da sala", async () => {
    const repositorio = criarRepositorioFalso({
      salas: [ATLANTICO, DOURO],
      reservas: [
        reserva("r-2", 2, "2026-10-22T14:00:00Z", "2026-10-22T15:00:00Z"),
        reserva("r-1", 1, "2026-10-20T09:30:00Z", "2026-10-20T11:00:00Z"),
      ],
    });

    const reservas = await listarReservas({ repositorio });

    expect(reservas).toEqual([
      {
        id: "r-1",
        salaId: 1,
        nomeSala: "Sala Atlântico",
        numeroPessoas: 2,
        inicio: new Date("2026-10-20T09:30:00Z"),
        fim: new Date("2026-10-20T11:00:00Z"),
      },
      {
        id: "r-2",
        salaId: 2,
        nomeSala: "Sala Douro",
        numeroPessoas: 2,
        inicio: new Date("2026-10-22T14:00:00Z"),
        fim: new Date("2026-10-22T15:00:00Z"),
      },
    ]);
  });

  it("usa nomeSala null quando a sala da reserva já não existe", async () => {
    const repositorio = criarRepositorioFalso({
      salas: [ATLANTICO],
      reservas: [reserva("r-1", 99, "2026-10-20T09:30:00Z", "2026-10-20T11:00:00Z")],
    });

    const [unica] = await listarReservas({ repositorio });

    expect(unica.nomeSala).toBeNull();
  });

  it("devolve uma lista vazia quando não há reservas", async () => {
    expect(await listarReservas({ repositorio: criarRepositorioFalso({ salas: [ATLANTICO] }) })).toEqual([]);
  });
});
