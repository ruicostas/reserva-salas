import { describe, expect, it } from "vitest";
import { ErroDominio } from "./erros.js";
import { criarReserva } from "./reserva.js";
import { CODIGOS_SOBREPOSICAO, garantirSalaLivre } from "./sobreposicao.js";

const SALA = 1;
const OUTRA_SALA = 2;

function reserva(id, salaId, inicio, fim) {
  return criarReserva({ id, salaId, inicio: new Date(inicio), fim: new Date(fim), numeroPessoas: 2 });
}

// Reserva já existente: sala 1, 20/10/2026 das 10:00 às 11:00 UTC.
const EXISTENTE = reserva(100, SALA, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z");

function codigoDoErro(funcao) {
  try {
    funcao();
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroDominio);
    return erro.codigo;
  }
  throw new Error("era esperado um ErroDominio");
}

describe("garantirSalaLivre", () => {
  it("aceita quando não há reservas existentes", () => {
    const nova = reserva(1, SALA, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z");
    expect(garantirSalaLivre(nova, [])).toBe(nova);
  });

  it.each([
    ["tem exatamente o mesmo horário", "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"],
    ["começa a meio da existente", "2026-10-20T10:30:00Z", "2026-10-20T11:30:00Z"],
    ["acaba a meio da existente", "2026-10-20T09:30:00Z", "2026-10-20T10:30:00Z"],
    ["fica dentro da existente", "2026-10-20T10:15:00Z", "2026-10-20T10:45:00Z"],
    ["contém a existente", "2026-10-20T09:00:00Z", "2026-10-20T12:00:00Z"],
  ])("rejeita na mesma sala quando a nova %s", (_descricao, inicio, fim) => {
    const nova = reserva(1, SALA, inicio, fim);
    expect(codigoDoErro(() => garantirSalaLivre(nova, [EXISTENTE]))).toBe(CODIGOS_SOBREPOSICAO.SALA_OCUPADA);
  });

  it("aceita reservas seguidas: a nova começa quando a existente acaba", () => {
    const nova = reserva(1, SALA, "2026-10-20T11:00:00Z", "2026-10-20T12:00:00Z");
    expect(garantirSalaLivre(nova, [EXISTENTE])).toBe(nova);
  });

  it("aceita reservas seguidas: a nova acaba quando a existente começa", () => {
    const nova = reserva(1, SALA, "2026-10-20T09:00:00Z", "2026-10-20T10:00:00Z");
    expect(garantirSalaLivre(nova, [EXISTENTE])).toBe(nova);
  });

  it("rejeita uma sobreposição de apenas 1 milissegundo", () => {
    const nova = reserva(1, SALA, "2026-10-20T10:59:59.999Z", "2026-10-20T12:00:00Z");
    expect(codigoDoErro(() => garantirSalaLivre(nova, [EXISTENTE]))).toBe(CODIGOS_SOBREPOSICAO.SALA_OCUPADA);
  });

  it("aceita uma sala diferente no mesmo horário", () => {
    const nova = reserva(1, OUTRA_SALA, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z");
    expect(garantirSalaLivre(nova, [EXISTENTE])).toBe(nova);
  });

  it("aceita a mesma sala à mesma hora noutro dia", () => {
    const nova = reserva(1, SALA, "2026-10-21T10:00:00Z", "2026-10-21T11:00:00Z");
    expect(garantirSalaLivre(nova, [EXISTENTE])).toBe(nova);
  });

  it("rejeita quando só uma de várias reservas existentes conflitua (a última)", () => {
    const existentes = [
      reserva(101, SALA, "2026-10-20T08:00:00Z", "2026-10-20T09:00:00Z"),
      reserva(102, OUTRA_SALA, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"),
      EXISTENTE,
    ];
    const nova = reserva(1, SALA, "2026-10-20T10:30:00Z", "2026-10-20T11:30:00Z");
    expect(codigoDoErro(() => garantirSalaLivre(nova, existentes))).toBe(CODIGOS_SOBREPOSICAO.SALA_OCUPADA);
  });

  it("aceita quando nenhuma de várias reservas existentes conflitua", () => {
    const existentes = [
      reserva(101, SALA, "2026-10-20T08:00:00Z", "2026-10-20T10:00:00Z"),
      reserva(102, SALA, "2026-10-20T11:00:00Z", "2026-10-20T13:00:00Z"),
      reserva(103, OUTRA_SALA, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z"),
    ];
    const nova = reserva(1, SALA, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z");
    expect(garantirSalaLivre(nova, existentes)).toBe(nova);
  });

  it("rejeita o mesmo instante escrito com fuso horário diferente", () => {
    const nova = reserva(1, SALA, "2026-10-20T11:00:00+01:00", "2026-10-20T12:00:00+01:00");
    expect(codigoDoErro(() => garantirSalaLivre(nova, [EXISTENTE]))).toBe(CODIGOS_SOBREPOSICAO.SALA_OCUPADA);
  });

  it("lança um ErroDominio quando a sala está ocupada", () => {
    const nova = reserva(1, SALA, "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z");
    expect(() => garantirSalaLivre(nova, [EXISTENTE])).toThrow(ErroDominio);
  });
});
