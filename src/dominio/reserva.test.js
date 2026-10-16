import { describe, expect, it } from "vitest";
import { ErroDominio } from "./erros.js";
import { CODIGOS_RESERVA, criarReserva } from "./reserva.js";

const INICIO = new Date("2026-10-20T09:30:00Z");
const FIM = new Date("2026-10-20T11:00:00Z");
const DADOS_VALIDOS = { id: 1, salaId: 2, inicio: INICIO, fim: FIM, numeroPessoas: 4 };

function codigoDoErro(funcao) {
  try {
    funcao();
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroDominio);
    return erro.codigo;
  }
  throw new Error("era esperado um ErroDominio");
}

describe("criarReserva", () => {
  it("cria uma reserva com os dados indicados", () => {
    const reserva = criarReserva(DADOS_VALIDOS);
    expect(reserva.id).toBe(1);
    expect(reserva.salaId).toBe(2);
    expect(reserva.inicio.toISOString()).toBe("2026-10-20T09:30:00.000Z");
    expect(reserva.fim.toISOString()).toBe("2026-10-20T11:00:00.000Z");
  });

  it("guarda o mesmo instante, seja qual for o fuso horário em que a data foi escrita", () => {
    const reserva = criarReserva({ ...DADOS_VALIDOS, inicio: new Date("2026-10-20T10:30:00+01:00") });
    expect(reserva.inicio.toISOString()).toBe("2026-10-20T09:30:00.000Z");
  });

  it("devolve uma reserva imutável", () => {
    const reserva = criarReserva(DADOS_VALIDOS);
    expect(Object.isFrozen(reserva)).toBe(true);
    expect(() => {
      "use strict";
      reserva.salaId = 99;
    }).toThrow(TypeError);
  });

  it("não é afetada por alterações posteriores às datas originais", () => {
    const inicio = new Date(INICIO.getTime());
    const reserva = criarReserva({ ...DADOS_VALIDOS, inicio });
    inicio.setUTCHours(0);
    expect(reserva.inicio.toISOString()).toBe("2026-10-20T09:30:00.000Z");
  });

  it.each([undefined, null, 0, -1, "", "  "])("rejeita o id inválido %o", (id) => {
    expect(codigoDoErro(() => criarReserva({ ...DADOS_VALIDOS, id }))).toBe(CODIGOS_RESERVA.ID_INVALIDO);
  });

  it.each([undefined, null, 0, ""])("rejeita o salaId inválido %o", (salaId) => {
    expect(codigoDoErro(() => criarReserva({ ...DADOS_VALIDOS, salaId }))).toBe(CODIGOS_RESERVA.SALA_INVALIDA);
  });

  it.each([undefined, null, "2026-10-20T09:30:00Z", 1792488600000, new Date("não é data")])(
    "rejeita o inicio inválido %o",
    (inicio) => {
      expect(codigoDoErro(() => criarReserva({ ...DADOS_VALIDOS, inicio }))).toBe(CODIGOS_RESERVA.DATA_INVALIDA);
    },
  );

  it("rejeita um fim inválido", () => {
    expect(codigoDoErro(() => criarReserva({ ...DADOS_VALIDOS, fim: "amanhã" }))).toBe(CODIGOS_RESERVA.DATA_INVALIDA);
  });

  it("rejeita um fim igual ao início", () => {
    expect(codigoDoErro(() => criarReserva({ ...DADOS_VALIDOS, fim: new Date(INICIO.getTime()) }))).toBe(
      CODIGOS_RESERVA.FIM_NAO_POSTERIOR_AO_INICIO,
    );
  });

  it("rejeita um fim anterior ao início", () => {
    expect(codigoDoErro(() => criarReserva({ ...DADOS_VALIDOS, inicio: FIM, fim: INICIO }))).toBe(
      CODIGOS_RESERVA.FIM_NAO_POSTERIOR_AO_INICIO,
    );
  });

  it("aceita uma reserva que atravessa a meia-noite", () => {
    const reserva = criarReserva({
      ...DADOS_VALIDOS,
      inicio: new Date("2026-10-20T23:00:00Z"),
      fim: new Date("2026-10-21T01:00:00Z"),
    });
    expect(reserva.fim.getTime() - reserva.inicio.getTime()).toBe(2 * 60 * 60 * 1000);
  });
});

describe("criarReserva — número de pessoas", () => {
  it("guarda o número de pessoas", () => {
    expect(criarReserva(DADOS_VALIDOS).numeroPessoas).toBe(4);
  });

  it("aceita o mínimo de 1 pessoa", () => {
    expect(criarReserva({ ...DADOS_VALIDOS, numeroPessoas: 1 }).numeroPessoas).toBe(1);
  });

  it.each([undefined, null, 0, -1, 1.5, "3", Number.NaN])("rejeita o número de pessoas inválido %o", (numeroPessoas) => {
    expect(codigoDoErro(() => criarReserva({ ...DADOS_VALIDOS, numeroPessoas }))).toBe(CODIGOS_RESERVA.NUMERO_PESSOAS_INVALIDO);
  });
});
