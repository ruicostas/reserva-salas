import { inspect } from "node:util";
import { describe, expect, it, vi } from "vitest";
import {
  CONSULTA_ATRIBUTOS_APP,
  CONSULTA_GRUPOS_APP,
  CONSULTA_UTILIZADOR_APP_EXISTE,
  INSTRUCOES_MIGRACAO,
  PRIVILEGIOS_ESPERADOS,
  UTILIZADOR_APP,
  VERIFICACAO_PRIVILEGIOS,
} from "./esquema.js";
import { criarLigacao } from "./ligacao.js";
import { CODIGOS_MIGRACAO, ErroMigracao, executarMigracao } from "./migracao.js";

const PALAVRA_PASSE = "Adm1n!Segredo";
const ENDERECO = `postgres://avnadmin:${encodeURIComponent(PALAVRA_PASSE)}@pg-reservas-abc.aivencloud.com:12345/defaultdb`;
const CERTIFICADO = "-----BEGIN CERTIFICATE-----\nMIIEQTCCAqmgAwIBAgIUZmFsc28=\n-----END CERTIFICATE-----";
const SEGREDOS = [PALAVRA_PASSE, "avnadmin", "pg-reservas-abc.aivencloud.com"];

// Respostas da base de dados simulada quando tudo está correto.
function linhasPrivilegios(alteracoes = {}) {
  return Object.entries({ ...PRIVILEGIOS_ESPERADOS, ...alteracoes }).map(([nome, tem]) => ({ nome, tem }));
}

const RESPOSTAS_OK = {
  utilizadorExiste: { rows: [{ existe: 1 }], rowCount: 1 },
  insercaoSalas: { rows: [], rowCount: 3 },
  privilegios: { rows: linhasPrivilegios(), rowCount: 0 },
  atributos: { rows: [{ rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false }] },
  grupos: { rows: [] },
};

// Pool com um cliente falso: regista cada consulta e responde conforme o SQL.
function criarBaseDadosFalsa(respostas = {}, { falharEm } = {}) {
  const r = { ...RESPOSTAS_OK, ...respostas };
  const executadas = [];
  const cliente = {
    release: vi.fn(),
    query: vi.fn(async (sql, parametros) => {
      executadas.push({ sql, parametros });
      if (falharEm && sql === falharEm.sql) {
        throw falharEm.erro;
      }
      if (sql === CONSULTA_UTILIZADOR_APP_EXISTE) return r.utilizadorExiste;
      if (sql === VERIFICACAO_PRIVILEGIOS) return r.privilegios;
      if (sql === CONSULTA_ATRIBUTOS_APP) return r.atributos;
      if (sql === CONSULTA_GRUPOS_APP) return r.grupos;
      if (sql.startsWith("INSERT INTO salas")) return r.insercaoSalas;
      return { rows: [], rowCount: 0 };
    }),
  };
  class PoolFalso {
    on() {
      return this;
    }

    async connect() {
      return cliente;
    }
  }
  const pool = criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, Pool: PoolFalso });
  return { pool, cliente, executadas, sqls: () => executadas.map((e) => e.sql) };
}

function semRegistos() {
  return vi.fn();
}

describe("executarMigracao — caminho feliz", () => {
  it("corre tudo numa só transação, pela ordem do esquema, e confirma no fim", async () => {
    const { pool, cliente, sqls, executadas } = criarBaseDadosFalsa();

    await executarMigracao(pool, { registar: semRegistos() });

    const ordem = sqls();
    expect(ordem[0]).toBe("BEGIN");
    expect(ordem.at(-1)).toBe("COMMIT");
    expect(ordem).not.toContain("ROLLBACK");
    const posicoes = INSTRUCOES_MIGRACAO.map((instrucao) => ordem.indexOf(instrucao.sql));
    expect(posicoes.every((posicao) => posicao > 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
    for (const instrucao of INSTRUCOES_MIGRACAO) {
      expect(executadas.find((e) => e.sql === instrucao.sql).parametros).toEqual(instrucao.parametros);
    }
    expect(cliente.release).toHaveBeenCalledTimes(1);
  });

  it("confirma que o utilizador app_reservas existe antes de alterar o esquema", async () => {
    const { pool, sqls, executadas } = criarBaseDadosFalsa();

    await executarMigracao(pool, { registar: semRegistos() });

    const ordem = sqls();
    expect(ordem.indexOf(CONSULTA_UTILIZADOR_APP_EXISTE)).toBeLessThan(ordem.indexOf(INSTRUCOES_MIGRACAO[0].sql));
    expect(executadas.find((e) => e.sql === CONSULTA_UTILIZADOR_APP_EXISTE).parametros).toEqual([UTILIZADOR_APP]);
  });

  it("verifica as permissões efetivas antes do COMMIT", async () => {
    const { pool, sqls } = criarBaseDadosFalsa();

    await executarMigracao(pool, { registar: semRegistos() });

    const ordem = sqls();
    expect(ordem.indexOf(VERIFICACAO_PRIVILEGIOS)).toBeLessThan(ordem.indexOf("COMMIT"));
    expect(ordem.indexOf(VERIFICACAO_PRIVILEGIOS)).toBeGreaterThan(ordem.indexOf(INSTRUCOES_MIGRACAO.at(-1).sql));
  });

  it("indica quantas salas de exemplo foram criadas (0 quando já existiam)", async () => {
    const primeira = criarBaseDadosFalsa();
    const segunda = criarBaseDadosFalsa({ insercaoSalas: { rows: [], rowCount: 0 } });

    expect((await executarMigracao(primeira.pool, { registar: semRegistos() })).salasCriadas).toBe(3);
    expect((await executarMigracao(segunda.pool, { registar: semRegistos() })).salasCriadas).toBe(0);
  });

  it("regista o progresso de cada passo", async () => {
    const { pool } = criarBaseDadosFalsa();
    const registar = vi.fn();

    await executarMigracao(pool, { registar });

    const textos = registar.mock.calls.map((chamada) => chamada.join(" "));
    for (const instrucao of INSTRUCOES_MIGRACAO) {
      expect(textos.some((texto) => texto.includes(instrucao.descricao))).toBe(true);
    }
  });
});

describe("executarMigracao — falhas", () => {
  it("para sem alterar nada quando o utilizador app_reservas não existe, e explica o que fazer", async () => {
    const { pool, cliente, sqls } = criarBaseDadosFalsa({ utilizadorExiste: { rows: [], rowCount: 0 } });

    const erro = await executarMigracao(pool, { registar: semRegistos() }).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroMigracao);
    expect(erro.codigo).toBe(CODIGOS_MIGRACAO.UTILIZADOR_APP_EM_FALTA);
    expect(erro.message).toContain("app_reservas");
    expect(erro.message).toContain("Aiven");
    expect(sqls()).toContain("ROLLBACK");
    for (const instrucao of INSTRUCOES_MIGRACAO) {
      expect(sqls()).not.toContain(instrucao.sql);
    }
    expect(cliente.release).toHaveBeenCalledTimes(1);
  });

  it("desfaz tudo (ROLLBACK) quando uma instrução falha, e diz qual foi, sem revelar segredos", async () => {
    const instrucao = INSTRUCOES_MIGRACAO[0];
    const erroPg = Object.assign(new Error(`permission denied for user avnadmin at pg-reservas-abc.aivencloud.com (${PALAVRA_PASSE})`), {
      code: "42501",
    });
    const { pool, cliente, sqls } = criarBaseDadosFalsa({}, { falharEm: { sql: instrucao.sql, erro: erroPg } });

    const erro = await executarMigracao(pool, { registar: semRegistos() }).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroMigracao);
    expect(erro.codigo).toBe(CODIGOS_MIGRACAO.INSTRUCAO_FALHOU);
    expect(erro.message).toContain(instrucao.descricao);
    expect(erro.message).toContain("42501");
    expect(sqls()).toContain("ROLLBACK");
    expect(sqls()).not.toContain("COMMIT");
    expect(cliente.release).toHaveBeenCalledTimes(1);
    for (const texto of [erro.message, erro.stack, inspect(erro, { depth: 5 })]) {
      for (const segredo of SEGREDOS) {
        expect(texto).not.toContain(segredo);
      }
    }
  });

  it("desfaz tudo quando as permissões efetivas não são as esperadas, e lista as diferenças", async () => {
    const { pool, sqls } = criarBaseDadosFalsa({
      privilegios: { rows: linhasPrivilegios({ "salas TRUNCATE": true, "base de dados TEMPORARY": true }) },
    });

    const erro = await executarMigracao(pool, { registar: semRegistos() }).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroMigracao);
    expect(erro.codigo).toBe(CODIGOS_MIGRACAO.PERMISSOES_INCORRETAS);
    expect(erro.message).toContain("salas TRUNCATE");
    expect(erro.message).toContain("base de dados TEMPORARY");
    expect(sqls()).toContain("ROLLBACK");
    expect(sqls()).not.toContain("COMMIT");
  });

  it("desfaz tudo quando falta uma verificação de permissões na resposta", async () => {
    const linhas = linhasPrivilegios().filter((linha) => linha.nome !== "reservas DELETE");
    const { pool, sqls } = criarBaseDadosFalsa({ privilegios: { rows: linhas } });

    const erro = await executarMigracao(pool, { registar: semRegistos() }).catch((e) => e);

    expect(erro.codigo).toBe(CODIGOS_MIGRACAO.PERMISSOES_INCORRETAS);
    expect(erro.message).toContain("reservas DELETE");
    expect(sqls()).toContain("ROLLBACK");
  });
});

describe("executarMigracao — avisos sobre o utilizador app_reservas", () => {
  it("avisa, sem bloquear, quando o utilizador tem atributos especiais ou pertence a outros grupos", async () => {
    const { pool, sqls } = criarBaseDadosFalsa({
      atributos: { rows: [{ ...RESPOSTAS_OK.atributos.rows[0], rolcreatedb: true }] },
      grupos: { rows: [{ grupo: "pg_read_all_data" }] },
    });
    const registar = vi.fn();

    const resultado = await executarMigracao(pool, { registar });

    expect(resultado.avisos.some((aviso) => aviso.includes("CREATEDB"))).toBe(true);
    expect(resultado.avisos.some((aviso) => aviso.includes("pg_read_all_data"))).toBe(true);
    expect(sqls().at(-1)).toBe("COMMIT");
  });

  it("não tem avisos quando o utilizador é simples", async () => {
    const { pool } = criarBaseDadosFalsa();

    expect((await executarMigracao(pool, { registar: semRegistos() })).avisos).toEqual([]);
  });
});
