import { describe, expect, it } from "vitest";
import { ErroDominio } from "./erros.js";
import { CODIGOS_SALA, criarSala } from "./sala.js";

const DADOS_VALIDOS = { id: 1, nome: "Sala Atlântico", capacidade: 12 };

function codigoDoErro(funcao) {
  try {
    funcao();
  } catch (erro) {
    expect(erro).toBeInstanceOf(ErroDominio);
    return erro.codigo;
  }
  throw new Error("era esperado um ErroDominio");
}

describe("criarSala", () => {
  it("cria uma sala com os dados indicados", () => {
    expect(criarSala(DADOS_VALIDOS)).toEqual({ id: 1, nome: "Sala Atlântico", capacidade: 12 });
  });

  it("aceita um id em texto (ex.: UUID)", () => {
    expect(criarSala({ ...DADOS_VALIDOS, id: "b7e1c2a0-uuid" }).id).toBe("b7e1c2a0-uuid");
  });

  it("remove espaços à volta do nome", () => {
    expect(criarSala({ ...DADOS_VALIDOS, nome: "  Sala Tejo  " }).nome).toBe("Sala Tejo");
  });

  it("devolve uma sala imutável", () => {
    const sala = criarSala(DADOS_VALIDOS);
    expect(Object.isFrozen(sala)).toBe(true);
    expect(() => {
      "use strict";
      sala.capacidade = 99;
    }).toThrow(TypeError);
  });

  it.each([undefined, null, 0, -1, 1.5, "", "   ", {}])("rejeita o id inválido %o", (id) => {
    expect(codigoDoErro(() => criarSala({ ...DADOS_VALIDOS, id }))).toBe(CODIGOS_SALA.ID_INVALIDO);
  });

  it.each([undefined, null, "", "   ", 42])("rejeita o nome inválido %o", (nome) => {
    expect(codigoDoErro(() => criarSala({ ...DADOS_VALIDOS, nome }))).toBe(CODIGOS_SALA.NOME_INVALIDO);
  });

  it.each([undefined, null, 0, -3, 2.5, "12", Number.NaN])("rejeita a capacidade inválida %o", (capacidade) => {
    expect(codigoDoErro(() => criarSala({ ...DADOS_VALIDOS, capacidade }))).toBe(CODIGOS_SALA.CAPACIDADE_INVALIDA);
  });

  it("aceita a capacidade mínima de 1 pessoa", () => {
    expect(criarSala({ ...DADOS_VALIDOS, capacidade: 1 }).capacidade).toBe(1);
  });
});
