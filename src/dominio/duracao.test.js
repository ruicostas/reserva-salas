import { describe, expect, it } from "vitest";
import { CODIGOS_DURACAO, garantirDuracaoMaxima } from "./duracao.js";
import { ErroDominio } from "./erros.js";
import { criarReserva } from "./reserva.js";

function reservaEntre(inicio, fim) {
  return criarReserva({ id: "r-1", salaId: 1, inicio: new Date(inicio), fim: new Date(fim), numeroPessoas: 2 });
}

function codigoDoErro(funcao) {
  try {
    funcao();
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroDominio);
    return erro.codigo;
  }
  throw new Error("era esperado um ErroDominio");
}

describe("garantirDuracaoMaxima (uma reserva tem no máximo 2 horas)", () => {
  it("permite exatamente 2 horas", () => {
    const reserva = reservaEntre("2026-11-10T10:00:00Z", "2026-11-10T12:00:00Z");
    expect(garantirDuracaoMaxima(reserva)).toBe(reserva);
  });

  it("recusa 2 horas e 1 minuto", () => {
    const reserva = reservaEntre("2026-11-10T10:00:00Z", "2026-11-10T12:01:00Z");
    expect(codigoDoErro(() => garantirDuracaoMaxima(reserva))).toBe(CODIGOS_DURACAO.DURACAO_MAXIMA_EXCEDIDA);
  });

  it("permite 30 minutos", () => {
    const reserva = reservaEntre("2026-11-10T10:00:00Z", "2026-11-10T10:30:00Z");
    expect(garantirDuracaoMaxima(reserva)).toBe(reserva);
  });
});

describe("garantirDuracaoMaxima — casos limite", () => {
  it("recusa 2 horas e 1 milissegundo", () => {
    const reserva = reservaEntre("2026-11-10T10:00:00.000Z", "2026-11-10T12:00:00.001Z");
    expect(codigoDoErro(() => garantirDuracaoMaxima(reserva))).toBe(CODIGOS_DURACAO.DURACAO_MAXIMA_EXCEDIDA);
  });

  it("permite uma reserva de 1 minuto (não existe duração mínima)", () => {
    const reserva = reservaEntre("2026-11-10T10:00:00Z", "2026-11-10T10:01:00Z");
    expect(garantirDuracaoMaxima(reserva)).toBe(reserva);
  });

  it("permite exatamente 2 horas quando a reserva atravessa a meia-noite", () => {
    const reserva = reservaEntre("2026-11-10T23:00:00Z", "2026-11-11T01:00:00Z");
    expect(garantirDuracaoMaxima(reserva)).toBe(reserva);
  });
});
