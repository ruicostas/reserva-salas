import { inspect } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { ErroDominio } from "../dominio/erros.js";
import { criarReserva } from "../dominio/reserva.js";
import { criarLigacao } from "./ligacao.js";
import { criarRepositorioPostgres, ErroRepositorio } from "./repositorioPostgres.js";

const PALAVRA_PASSE = "App!Segredo42";
const SERVIDOR = "pg-reservas-abc.aivencloud.com";
const ENDERECO = `postgres://app_reservas:${encodeURIComponent(PALAVRA_PASSE)}@${SERVIDOR}:12345/defaultdb`;
const CERTIFICADO = "-----BEGIN CERTIFICATE-----\nMIIEQTCCAqmgAwIBAgIUZmFsc28=\n-----END CERTIFICATE-----";

const SALA_ID = "6f1c2a8e-1b2c-4d3e-8f90-0a1b2c3d4e5f";
const MALICIOSO = "'; DROP TABLE reservas; --";

// Pool falso criado pela ligação segura (para as mensagens de erro serem limpas); query devolve o que cada teste definir.
function criarPoolFalso(respostaQuery) {
  const query = vi.fn(respostaQuery ?? (async () => ({ rows: [] })));
  class PoolFalso {
    on() {
      return this;
    }
  }
  PoolFalso.prototype.query = query;
  return { pool: criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, Pool: PoolFalso }), query };
}

function reserva() {
  return criarReserva({
    id: "0b0e0c7e-0000-4000-8000-000000000001",
    salaId: SALA_ID,
    inicio: new Date("2026-11-10T10:00:00.123Z"),
    fim: new Date("2026-11-10T11:00:00.000Z"),
    numeroPessoas: 37,
  });
}

function linhaDe(r) {
  return { id: r.id, sala_id: r.salaId, inicio: r.inicio, fim: r.fim, numero_pessoas: r.numeroPessoas };
}

describe("criarRepositorioPostgres — consultas sempre com parâmetros", () => {
  it("listarReservasDaSala passa o id da sala como parâmetro, nunca no texto do SQL", async () => {
    const { pool, query } = criarPoolFalso();

    await criarRepositorioPostgres(pool).listarReservasDaSala(MALICIOSO);

    const [sql, parametros] = query.mock.calls[0];
    expect(sql).not.toContain(MALICIOSO);
    expect(sql).toMatch(/\$1/);
    expect(parametros).toEqual([MALICIOSO]);
  });

  it("guardarReserva passa todos os valores como parâmetros, com as datas como Date", async () => {
    const r = reserva();
    const { pool, query } = criarPoolFalso(async () => ({ rows: [linhaDe(r)] }));

    await criarRepositorioPostgres(pool).guardarReserva(r);

    const [sql, parametros] = query.mock.calls[0];
    for (const valor of [r.id, r.salaId, "2026-11-10", "37"]) {
      expect(sql).not.toContain(valor);
    }
    expect(parametros).toEqual([r.id, r.salaId, r.inicio, r.fim, 37]);
    expect(parametros[2]).toBeInstanceOf(Date);
  });

  it("as consultas sem filtro não recebem valores", async () => {
    const { pool, query } = criarPoolFalso();
    const repositorio = criarRepositorioPostgres(pool);

    await repositorio.listarSalas();
    await repositorio.listarReservas();

    for (const [sql, parametros] of query.mock.calls) {
      expect(sql).not.toMatch(/\$\d/);
      expect(parametros ?? []).toEqual([]);
    }
  });
});

describe("criarRepositorioPostgres — conversão das linhas", () => {
  it("devolve as salas como entidades do domínio", async () => {
    const { pool } = criarPoolFalso(async () => ({ rows: [{ id: SALA_ID, nome: "Sala A", capacidade: 6 }] }));

    const [sala] = await criarRepositorioPostgres(pool).listarSalas();

    expect(sala).toEqual({ id: SALA_ID, nome: "Sala A", capacidade: 6 });
    expect(Object.isFrozen(sala)).toBe(true);
  });

  it("devolve as reservas como entidades do domínio, com os nomes de campo da aplicação", async () => {
    const r = reserva();
    const { pool } = criarPoolFalso(async () => ({ rows: [linhaDe(r)] }));

    const [lida] = await criarRepositorioPostgres(pool).listarReservas();

    expect(lida).toEqual({ id: r.id, salaId: SALA_ID, inicio: r.inicio, fim: r.fim, numeroPessoas: 37 });
    expect(Object.isFrozen(lida)).toBe(true);
  });

  it("guardarReserva devolve a reserva tal como ficou gravada", async () => {
    const r = reserva();
    const { pool } = criarPoolFalso(async () => ({ rows: [linhaDe(r)] }));

    const devolvida = await criarRepositorioPostgres(pool).guardarReserva(r);

    expect(devolvida).toEqual(r);
  });
});

describe("criarRepositorioPostgres — erros", () => {
  it("traduz a recusa por sobreposição da base de dados (23P01) para o erro de domínio SALA_OCUPADA", async () => {
    const erroPg = Object.assign(new Error('conflicting key value violates exclusion constraint "reservas_sem_sobreposicao"'), {
      code: "23P01",
    });
    const { pool } = criarPoolFalso(async () => {
      throw erroPg;
    });

    const erro = await criarRepositorioPostgres(pool)
      .guardarReserva(reserva())
      .catch((e) => e);

    expect(erro).toBeInstanceOf(ErroDominio);
    expect(erro.codigo).toBe("SALA_OCUPADA");
  });

  it("outros erros saem como ErroRepositorio, com o código e sem o servidor, o utilizador nem a palavra-passe", async () => {
    const erroPg = Object.assign(new Error(`permission denied for table reservas (app_reservas at ${SERVIDOR}, ${PALAVRA_PASSE})`), {
      code: "42501",
    });
    const { pool } = criarPoolFalso(async () => {
      throw erroPg;
    });

    const erro = await criarRepositorioPostgres(pool)
      .listarReservas()
      .catch((e) => e);

    expect(erro).toBeInstanceOf(ErroRepositorio);
    expect(erro.codigoPostgres).toBe("42501");
    expect(erro.message).toContain("42501");
    for (const texto of [erro.message, erro.stack, inspect(erro, { depth: 5 })]) {
      for (const segredo of [PALAVRA_PASSE, SERVIDOR, "app_reservas"]) {
        expect(texto).not.toContain(segredo);
      }
    }
  });
});
