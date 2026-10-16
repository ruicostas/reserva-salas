import { describe, expect, it } from "vitest";
import { CODIGOS_CAPACIDADE, garantirCapacidade } from "./capacidade.js";
import { ErroDominio } from "./erros.js";
import { criarReserva } from "./reserva.js";
import { criarSala } from "./sala.js";

const DOURO = criarSala({ id: 2, nome: "Sala Douro", capacidade: 6 });

function reservaPara(numeroPessoas, salaId = 2) {
  return criarReserva({
    id: "r-1",
    salaId,
    inicio: new Date("2026-10-20T10:00:00Z"),
    fim: new Date("2026-10-20T11:00:00Z"),
    numeroPessoas,
  });
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

describe("garantirCapacidade", () => {
  it("aceita e devolve a reserva quando o número de pessoas é menor do que a capacidade", () => {
    const reserva = reservaPara(2);
    expect(garantirCapacidade(DOURO, reserva)).toBe(reserva);
  });

  it("aceita quando o número de pessoas é igual à capacidade (limite)", () => {
    const reserva = reservaPara(6);
    expect(garantirCapacidade(DOURO, reserva)).toBe(reserva);
  });

  it("rejeita quando o número de pessoas excede a capacidade por 1 (limite)", () => {
    expect(codigoDoErro(() => garantirCapacidade(DOURO, reservaPara(7)))).toBe(CODIGOS_CAPACIDADE.CAPACIDADE_EXCEDIDA);
  });

  it("rejeita quando o número de pessoas excede muito a capacidade", () => {
    expect(codigoDoErro(() => garantirCapacidade(DOURO, reservaPara(50)))).toBe(CODIGOS_CAPACIDADE.CAPACIDADE_EXCEDIDA);
  });

  it("rejeita quando a reserva não é da sala indicada", () => {
    expect(codigoDoErro(() => garantirCapacidade(DOURO, reservaPara(2, 1)))).toBe(CODIGOS_CAPACIDADE.SALA_DIFERENTE);
  });
});
