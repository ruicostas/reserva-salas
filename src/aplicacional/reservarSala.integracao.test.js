import { describe, expect, it } from "vitest";
import { criarSala } from "../dominio/sala.js";
import { criarRepositorioMemoria } from "../persistencia/repositorioMemoria.js";
import { listarReservas } from "./listarReservas.js";
import { reservarSala } from "./reservarSala.js";

// Integração: casos de uso com o repositório em memória real, em vez da persistência simulada.
describe("reservarSala com o repositório em memória", () => {
  it("aceita reservas seguidas, rejeita a sobreposta e lista só as guardadas", async () => {
    const repositorio = criarRepositorioMemoria({ salas: [criarSala({ id: 1, nome: "Sala Atlântico", capacidade: 12 })] });
    const dependencias = { repositorio };

    const primeira = await reservarSala(dependencias, {
      salaId: 1,
      inicio: new Date("2026-10-20T10:00:00Z"),
      fim: new Date("2026-10-20T11:00:00Z"),
    });
    const seguida = await reservarSala(dependencias, {
      salaId: 1,
      inicio: new Date("2026-10-20T11:00:00Z"),
      fim: new Date("2026-10-20T12:00:00Z"),
    });
    const sobreposta = await reservarSala(dependencias, {
      salaId: 1,
      inicio: new Date("2026-10-20T10:30:00Z"),
      fim: new Date("2026-10-20T11:30:00Z"),
    });

    expect(primeira.sucesso).toBe(true);
    expect(seguida.sucesso).toBe(true);
    expect(sobreposta).toEqual({ sucesso: false, erro: "SALA_OCUPADA" });

    const reservas = await listarReservas(dependencias);
    expect(reservas.map((reserva) => reserva.id)).toEqual([primeira.reserva.id, seguida.reserva.id]);
    expect(reservas.every((reserva) => "Sala Atlântico" === reserva.nomeSala)).toBe(true);
  });
});
