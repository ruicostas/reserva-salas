import { describe, expect, it } from "vitest";
import { METODOS_REPOSITORIO } from "../aplicacional/repositorio.js";
import { criarReserva } from "../dominio/reserva.js";
import { criarSala } from "../dominio/sala.js";
import { criarRepositorioMemoria } from "./repositorioMemoria.js";

const ATLANTICO = criarSala({ id: 1, nome: "Sala Atlântico", capacidade: 12 });
const DOURO = criarSala({ id: 2, nome: "Sala Douro", capacidade: 6 });

function reserva(id, salaId, inicio, fim) {
  return criarReserva({ id, salaId, inicio: new Date(inicio), fim: new Date(fim), numeroPessoas: 2 });
}

const R1 = reserva("r-1", 1, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z");
const R2 = reserva("r-2", 2, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z");

describe("criarRepositorioMemoria", () => {
  it("cumpre a interface do repositório: todos os métodos existem e são assíncronos", () => {
    const repositorio = criarRepositorioMemoria();
    for (const metodo of METODOS_REPOSITORIO) {
      expect(typeof repositorio[metodo]).toBe("function");
      expect(repositorio[metodo]("x")).toBeInstanceOf(Promise);
    }
  });

  it("começa vazio quando não recebe dados", async () => {
    const repositorio = criarRepositorioMemoria();
    expect(await repositorio.listarSalas()).toEqual([]);
    expect(await repositorio.listarReservas()).toEqual([]);
  });

  it("lista as salas e as reservas iniciais", async () => {
    const repositorio = criarRepositorioMemoria({ salas: [ATLANTICO, DOURO], reservas: [R1, R2] });
    expect(await repositorio.listarSalas()).toEqual([ATLANTICO, DOURO]);
    expect(await repositorio.listarReservas()).toEqual([R1, R2]);
  });

  it("lista apenas as reservas da sala pedida", async () => {
    const repositorio = criarRepositorioMemoria({ salas: [ATLANTICO, DOURO], reservas: [R1, R2] });
    expect(await repositorio.listarReservasDaSala(2)).toEqual([R2]);
    expect(await repositorio.listarReservasDaSala(99)).toEqual([]);
  });

  it("guarda uma reserva, devolve-a e passa a listá-la", async () => {
    const repositorio = criarRepositorioMemoria({ salas: [ATLANTICO] });

    expect(await repositorio.guardarReserva(R1)).toBe(R1);
    expect(await repositorio.listarReservas()).toEqual([R1]);
    expect(await repositorio.listarReservasDaSala(1)).toEqual([R1]);
  });

  it("não deixa alterar o estado interno através dos arrays devolvidos", async () => {
    const repositorio = criarRepositorioMemoria({ salas: [ATLANTICO], reservas: [R1] });

    (await repositorio.listarSalas()).push(DOURO);
    (await repositorio.listarReservas()).length = 0;
    (await repositorio.listarReservasDaSala(1)).push(R2);

    expect(await repositorio.listarSalas()).toEqual([ATLANTICO]);
    expect(await repositorio.listarReservas()).toEqual([R1]);
  });

  it("não é afetado por alterações posteriores aos arrays iniciais", async () => {
    const salas = [ATLANTICO];
    const repositorio = criarRepositorioMemoria({ salas });

    salas.push(DOURO);

    expect(await repositorio.listarSalas()).toEqual([ATLANTICO]);
  });
});
