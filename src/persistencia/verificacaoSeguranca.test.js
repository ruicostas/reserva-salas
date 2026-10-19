import { inspect } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { criarLigacao } from "./ligacao.js";
import {
  CONSULTA_RESERVA_TESTE,
  CONSULTA_SESSAO,
  CONSULTA_SSL_SERVIDOR,
  CONSULTA_TABELA_EXISTE,
  ErroVerificacao,
  formatarRelatorio,
  GRAVAR_RESERVA_TESTE,
  verificarSeguranca,
} from "./verificacaoSeguranca.js";

const PALAVRA_PASSE = "App!Segredo42";
const SERVIDOR = "pg-reservas-abc.aivencloud.com";
const ENDERECO = `postgres://app_reservas:${encodeURIComponent(PALAVRA_PASSE)}@${SERVIDOR}:12345/defaultdb`;
const CERTIFICADO = "-----BEGIN CERTIFICATE-----\nMIIEQTCCAqmgAwIBAgIUZmFsc28=\n-----END CERTIFICATE-----";
const SEGREDOS = [PALAVRA_PASSE, encodeURIComponent(PALAVRA_PASSE), SERVIDOR, ENDERECO];

function socketTls(alteracoes = {}) {
  return {
    encrypted: true,
    authorized: true,
    authorizationError: null,
    getProtocol: () => "TLSv1.3",
    getCipher: () => ({ name: "TLS_AES_256_GCM_SHA384", standardName: "TLS_AES_256_GCM_SHA384", version: "TLSv1.3" }),
    getPeerCertificate: () => ({ subject: { CN: SERVIDOR }, issuer: { CN: "Aiven Project CA", O: "Aiven" }, valid_to: "Jan  1 00:00:00 2036 GMT" }),
    ...alteracoes,
  };
}

const RESPOSTAS_OK = {
  sessao: { rows: [{ utilizador: "app_reservas", utilizador_sessao: "app_reservas" }] },
  sslServidor: { rows: [{ ssl: true, versao: "TLSv1.3", cifra: "TLS_AES_256_GCM_SHA384" }] },
  gravar: { rows: [{ id: "0b0e0c7e-0000-4000-8000-000000000001" }], rowCount: 1 },
  apagar: Object.assign(new Error("must be owner of table reservas"), { code: "42501" }),
  reservaTeste: { rows: [{ total: 0 }] },
  tabelaExiste: { rows: [{ existe: true }] },
};

// Cliente falso: responde conforme o SQL e regista a ordem. Um valor Error na resposta é lançado.
function criarBaseDadosFalsa(respostas = {}, { stream = socketTls(), falharEm } = {}) {
  const r = { ...RESPOSTAS_OK, ...respostas };
  const executadas = [];
  const responder = (resposta) => {
    if (resposta instanceof Error) {
      throw resposta;
    }
    return resposta;
  };
  const cliente = {
    connection: { stream },
    release: vi.fn(),
    query: vi.fn(async (sql, parametros) => {
      executadas.push({ sql, parametros });
      if (falharEm === sql) throw Object.assign(new Error(`connection to ${SERVIDOR} terminated`), { code: "57P01" });
      if (sql === CONSULTA_SESSAO) return responder(r.sessao);
      if (sql === CONSULTA_SSL_SERVIDOR) return responder(r.sslServidor);
      if (sql === GRAVAR_RESERVA_TESTE) return responder(r.gravar);
      if (sql === "DROP TABLE reservas") return responder(r.apagar === null ? { rows: [] } : r.apagar);
      if (sql === CONSULTA_RESERVA_TESTE) return responder(r.reservaTeste);
      if (sql === CONSULTA_TABELA_EXISTE) return responder(r.tabelaExiste);
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
  return { pool, cliente, sqls: () => executadas.map((e) => e.sql), executadas };
}

function verificacao(relatorio, inicioDescricao) {
  const encontrada = relatorio.verificacoes.find((v) => v.descricao.startsWith(inicioDescricao));
  expect(encontrada, `verificação "${inicioDescricao}"`).toBeDefined();
  return encontrada;
}

function esperarSemSegredos(textos) {
  for (const texto of textos) {
    for (const segredo of SEGREDOS) {
      expect(texto, `não pode conter "${segredo}"`).not.toContain(segredo);
    }
  }
}

describe("verificarSeguranca — tudo correto", () => {
  it("passa todas as verificações", async () => {
    const { pool } = criarBaseDadosFalsa();

    const relatorio = await verificarSeguranca(pool);

    expect(relatorio.ok).toBe(true);
    expect(relatorio.verificacoes.every((v) => v.ok)).toBe(true);
  });

  it("indica a cifra, o protocolo, quem emitiu o certificado e o utilizador", async () => {
    const { pool } = criarBaseDadosFalsa();

    const relatorio = await verificarSeguranca(pool);

    expect(relatorio.tls).toMatchObject({ cifrada: true, protocolo: "TLSv1.3", cifra: "TLS_AES_256_GCM_SHA384", certificadoConfirmado: true });
    expect(relatorio.tls.emissor).toContain("Aiven Project CA");
    expect(relatorio.tls.validoAte).toContain("2036");
    expect(relatorio.servidor).toEqual({ ssl: true, versao: "TLSv1.3", cifra: "TLS_AES_256_GCM_SHA384" });
    expect(relatorio.utilizador).toBe("app_reservas");
  });

  it("grava a reserva de teste e tenta apagar a tabela dentro de uma transação que é anulada", async () => {
    const { pool, sqls } = criarBaseDadosFalsa();

    await verificarSeguranca(pool);

    const ordem = sqls();
    const posicao = (sql) => ordem.indexOf(sql);
    expect(posicao("BEGIN")).toBeGreaterThanOrEqual(0);
    expect(posicao("BEGIN")).toBeLessThan(posicao(GRAVAR_RESERVA_TESTE));
    expect(posicao(GRAVAR_RESERVA_TESTE)).toBeLessThan(posicao("DROP TABLE reservas"));
    expect(posicao("DROP TABLE reservas")).toBeLessThan(posicao("ROLLBACK"));
    expect(posicao("ROLLBACK")).toBeLessThan(posicao(CONSULTA_RESERVA_TESTE));
    expect(ordem).not.toContain("COMMIT");
  });

  it("limita a espera por bloqueios antes de gravar e de apagar, para não prender a aplicação", async () => {
    const { pool, sqls } = criarBaseDadosFalsa();

    await verificarSeguranca(pool);

    const ordem = sqls();
    const limite = ordem.findIndex((sql) => sql.includes("lock_timeout"));
    expect(limite).toBeGreaterThan(ordem.indexOf("BEGIN"));
    expect(limite).toBeLessThan(ordem.indexOf(GRAVAR_RESERVA_TESTE));
  });

  it("confirma depois do ROLLBACK que a reserva de teste não ficou e que a tabela continua lá", async () => {
    const { pool, executadas } = criarBaseDadosFalsa();

    const relatorio = await verificarSeguranca(pool);

    expect(executadas.find((e) => e.sql === CONSULTA_RESERVA_TESTE).parametros).toEqual([RESPOSTAS_OK.gravar.rows[0].id]);
    expect(verificacao(relatorio, "Nada ficou gravado").ok).toBe(true);
    expect(verificacao(relatorio, "A tabela reservas continua").ok).toBe(true);
  });

  it("devolve a ligação destruída ao pool (release(true)), para não ser reutilizada", async () => {
    const { pool, cliente } = criarBaseDadosFalsa();

    await verificarSeguranca(pool);

    expect(cliente.release).toHaveBeenCalledWith(true);
  });
});

describe("verificarSeguranca — problemas detetados", () => {
  it("falha quando a ligação não está cifrada", async () => {
    const { pool } = criarBaseDadosFalsa({}, { stream: { encrypted: false } });

    const relatorio = await verificarSeguranca(pool);

    expect(relatorio.ok).toBe(false);
    expect(verificacao(relatorio, "Ligação cifrada").ok).toBe(false);
  });

  it("falha quando o protocolo é anterior ao TLS 1.2", async () => {
    const { pool } = criarBaseDadosFalsa({}, { stream: socketTls({ getProtocol: () => "TLSv1.1" }) });

    const relatorio = await verificarSeguranca(pool);

    expect(verificacao(relatorio, "Protocolo seguro").ok).toBe(false);
  });

  it("falha quando o certificado não foi confirmado", async () => {
    const { pool } = criarBaseDadosFalsa({}, { stream: socketTls({ authorized: false, authorizationError: "SELF_SIGNED_CERT_IN_CHAIN" }) });

    const relatorio = await verificarSeguranca(pool);

    const certificado = verificacao(relatorio, "Certificado do servidor confirmado");
    expect(certificado.ok).toBe(false);
    expect(certificado.detalhe).toContain("SELF_SIGNED_CERT_IN_CHAIN");
  });

  it("falha quando o servidor diz que a sessão não usa SSL", async () => {
    const { pool } = criarBaseDadosFalsa({ sslServidor: { rows: [{ ssl: false, versao: null, cifra: null }] } });

    const relatorio = await verificarSeguranca(pool);

    expect(verificacao(relatorio, "O servidor confirma").ok).toBe(false);
  });

  it("falha quando entrou com outro utilizador (ex.: o administrador)", async () => {
    const { pool } = criarBaseDadosFalsa({ sessao: { rows: [{ utilizador: "avnadmin", utilizador_sessao: "avnadmin" }] } });

    const relatorio = await verificarSeguranca(pool);

    const utilizador = verificacao(relatorio, "Entrou como app_reservas");
    expect(utilizador.ok).toBe(false);
    expect(utilizador.detalhe).toContain("avnadmin");
  });

  it("falha quando não consegue gravar a reserva de teste, e continua as outras verificações", async () => {
    const { pool, sqls } = criarBaseDadosFalsa({ gravar: Object.assign(new Error("permission denied for table reservas"), { code: "42501" }) });

    const relatorio = await verificarSeguranca(pool);

    const gravar = verificacao(relatorio, "Consegue gravar");
    expect(gravar.ok).toBe(false);
    expect(gravar.detalhe).toContain("42501");
    expect(sqls()).toContain("DROP TABLE reservas");
    expect(sqls()).toContain("ROLLBACK");
  });

  it("falha quando não há salas para a reserva de teste, e diz para correr a migração", async () => {
    const { pool } = criarBaseDadosFalsa({ gravar: { rows: [], rowCount: 0 } });

    const relatorio = await verificarSeguranca(pool);

    const gravar = verificacao(relatorio, "Consegue gravar");
    expect(gravar.ok).toBe(false);
    expect(gravar.detalhe).toContain("npm run migrar");
  });

  it("falha, e anula tudo, quando o utilizador CONSEGUE apagar a tabela", async () => {
    const { pool, sqls } = criarBaseDadosFalsa({ apagar: null });

    const relatorio = await verificarSeguranca(pool);

    expect(verificacao(relatorio, "Não consegue apagar").ok).toBe(false);
    expect(sqls()).toContain("ROLLBACK");
    expect(sqls()).not.toContain("COMMIT");
    expect(relatorio.ok).toBe(false);
  });

  it("falha quando o apagar é recusado por outro motivo que não a falta de permissão", async () => {
    const { pool } = criarBaseDadosFalsa({ apagar: Object.assign(new Error("canceling statement due to lock timeout"), { code: "55P03" }) });

    const relatorio = await verificarSeguranca(pool);

    const apagar = verificacao(relatorio, "Não consegue apagar");
    expect(apagar.ok).toBe(false);
    expect(apagar.detalhe).toContain("55P03");
  });

  it("falha quando a reserva de teste aparece depois do ROLLBACK", async () => {
    const { pool } = criarBaseDadosFalsa({ reservaTeste: { rows: [{ total: 1 }] } });

    const relatorio = await verificarSeguranca(pool);

    expect(verificacao(relatorio, "Nada ficou gravado").ok).toBe(false);
  });

  it("anula a transação e liberta a ligação quando a ligação cai a meio, sem revelar segredos", async () => {
    const { pool, cliente, sqls } = criarBaseDadosFalsa({}, { falharEm: "SAVEPOINT antes_de_gravar" });

    const erro = await verificarSeguranca(pool).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroVerificacao);
    expect(erro.message).toContain("57P01");
    expect(sqls()).toContain("ROLLBACK");
    expect(sqls()).not.toContain("COMMIT");
    expect(cliente.release).toHaveBeenCalledWith(true);
    esperarSemSegredos([erro.message, erro.stack, inspect(erro, { depth: 5 })]);
  });
});

describe("formatarRelatorio", () => {
  it("mostra cada verificação com ✓ ou ✗ e um resultado final", async () => {
    const { pool } = criarBaseDadosFalsa({ apagar: null });

    const texto = formatarRelatorio(await verificarSeguranca(pool));

    expect(texto).toContain("✓ Ligação cifrada");
    expect(texto).toContain("✗ Não consegue apagar");
    expect(texto).toMatch(/TLS_AES_256_GCM_SHA384/);
    expect(texto).toMatch(/app_reservas/);
    expect(texto).toMatch(/FALHOU/);
  });

  it("nunca mostra o endereço, o servidor nem a palavra-passe", async () => {
    const { pool } = criarBaseDadosFalsa();

    const relatorio = await verificarSeguranca(pool);

    esperarSemSegredos([formatarRelatorio(relatorio), JSON.stringify(relatorio), inspect(relatorio, { depth: 10 })]);
  });
});
