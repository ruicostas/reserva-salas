import { describe, expect, it } from "vitest";
import { criarReserva } from "../dominio/reserva.js";
import { criarSala } from "../dominio/sala.js";
import { criarRepositorioFalso } from "./repositorioFalso.js";
import { CODIGOS_RESERVAR_SALA, reservarSala } from "./reservarSala.js";

const ATLANTICO = criarSala({ id: 1, nome: "Sala Atlântico", capacidade: 12 });
const DOURO = criarSala({ id: 2, nome: "Sala Douro", capacidade: 6 });

// Reserva já existente: Atlântico, 20/10/2026 das 10:00 às 11:00 UTC.
const EXISTENTE = criarReserva({
  id: "r-existente",
  salaId: 1,
  inicio: new Date("2026-10-20T10:00:00Z"),
  fim: new Date("2026-10-20T11:00:00Z"),
});

function pedido(salaId, inicio, fim) {
  return { salaId, inicio: new Date(inicio), fim: new Date(fim) };
}

function dependencias(repositorio) {
  return { repositorio, gerarId: () => "r-nova" };
}

describe("reservarSala", () => {
  it("cria e guarda a reserva quando a sala está livre", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO, DOURO] });

    const resultado = await reservarSala(dependencias(repositorio), pedido(1, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"));

    expect(resultado.sucesso).toBe(true);
    expect(resultado.reserva.id).toBe("r-nova");
    expect(resultado.reserva.salaId).toBe(1);
    expect(resultado.reserva.inicio.toISOString()).toBe("2026-10-20T10:00:00.000Z");
    expect(resultado.reserva.fim.toISOString()).toBe("2026-10-20T11:00:00.000Z");
    expect(repositorio.guardarReserva).toHaveBeenCalledTimes(1);
    expect(repositorio.guardarReserva).toHaveBeenCalledWith(resultado.reserva);
  });

  it("consulta apenas as reservas da sala pedida", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO, DOURO] });

    await reservarSala(dependencias(repositorio), pedido(2, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"));

    expect(repositorio.listarReservasDaSala).toHaveBeenCalledWith(2);
  });

  it("gera um id quando não é indicado um gerador", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO] });

    const resultado = await reservarSala({ repositorio }, pedido(1, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"));

    expect(resultado.sucesso).toBe(true);
    expect(typeof resultado.reserva.id).toBe("string");
    expect(resultado.reserva.id.length).toBeGreaterThan(0);
  });

  it("devolve SALA_INEXISTENTE e não guarda quando a sala não existe", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO] });

    const resultado = await reservarSala(dependencias(repositorio), pedido(99, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"));

    expect(resultado).toEqual({ sucesso: false, erro: CODIGOS_RESERVAR_SALA.SALA_INEXISTENTE });
    expect(repositorio.guardarReserva).not.toHaveBeenCalled();
  });

  it("devolve SALA_OCUPADA e não guarda quando há sobreposição", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO], reservas: [EXISTENTE] });

    const resultado = await reservarSala(dependencias(repositorio), pedido(1, "2026-10-20T10:30:00Z", "2026-10-20T11:30:00Z"));

    expect(resultado).toEqual({ sucesso: false, erro: "SALA_OCUPADA" });
    expect(repositorio.guardarReserva).not.toHaveBeenCalled();
  });

  it("aceita uma reserva seguida a outra na mesma sala", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO], reservas: [EXISTENTE] });

    const resultado = await reservarSala(dependencias(repositorio), pedido(1, "2026-10-20T11:00:00Z", "2026-10-20T12:00:00Z"));

    expect(resultado.sucesso).toBe(true);
  });

  it("aceita outra sala no mesmo horário de uma reserva existente", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO, DOURO], reservas: [EXISTENTE] });

    const resultado = await reservarSala(dependencias(repositorio), pedido(2, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"));

    expect(resultado.sucesso).toBe(true);
  });

  it("devolve o código do domínio quando as datas são inválidas", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO] });

    const resultado = await reservarSala(dependencias(repositorio), { salaId: 1, inicio: "amanhã", fim: new Date() });

    expect(resultado).toEqual({ sucesso: false, erro: "RESERVA_DATA_INVALIDA" });
    expect(repositorio.guardarReserva).not.toHaveBeenCalled();
  });

  it("devolve o código do domínio quando o fim não é depois do início", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO] });

    const resultado = await reservarSala(dependencias(repositorio), pedido(1, "2026-10-20T11:00:00Z", "2026-10-20T10:00:00Z"));

    expect(resultado).toEqual({ sucesso: false, erro: "RESERVA_FIM_NAO_POSTERIOR_AO_INICIO" });
  });

  it("devolve ERRO_INESPERADO, sem lançar exceção, quando o repositório falha a ler", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO] });
    repositorio.listarSalas.mockRejectedValue(new Error("ligação perdida"));

    const resultado = await reservarSala(dependencias(repositorio), pedido(1, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"));

    expect(resultado).toEqual({ sucesso: false, erro: CODIGOS_RESERVAR_SALA.ERRO_INESPERADO });
  });

  it("devolve ERRO_INESPERADO, sem lançar exceção, quando o repositório falha a guardar", async () => {
    const repositorio = criarRepositorioFalso({ salas: [ATLANTICO] });
    repositorio.guardarReserva.mockRejectedValue(new Error("disco cheio"));

    const resultado = await reservarSala(dependencias(repositorio), pedido(1, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"));

    expect(resultado).toEqual({ sucesso: false, erro: CODIGOS_RESERVAR_SALA.ERRO_INESPERADO });
  });
});
