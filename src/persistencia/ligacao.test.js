import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CODIGOS_LIGACAO, criarLigacao, ErroLigacao, mensagemSegura, verificarLigacao } from "./ligacao.js";

// Valores falsos: os testes nunca usam credenciais reais nem ligam a uma base de dados.
const PALAVRA_PASSE = "S3gr3d0!Pass";
const UTILIZADOR = "avnadmin";
const SERVIDOR = "pg-reservas-abc.aivencloud.com";
const ENDERECO = `postgres://${UTILIZADOR}:${encodeURIComponent(PALAVRA_PASSE)}@${SERVIDOR}:12345/defaultdb?sslmode=require`;
const SEGREDOS = [PALAVRA_PASSE, encodeURIComponent(PALAVRA_PASSE), UTILIZADOR, SERVIDOR, ENDERECO];

const CERTIFICADO = "-----BEGIN CERTIFICATE-----\nMIIEQTCCAqmgAwIBAgIUZmFsc28=\n-----END CERTIFICATE-----";

// Pool simulado: guarda a configuração recebida e os tratadores de eventos, sem abrir ligações.
function criarPoolFalso() {
  const instancias = [];
  class PoolFalso {
    constructor(configuracao) {
      this.configuracao = configuracao;
      this.tratadores = {};
      this.query = vi.fn();
      instancias.push(this);
    }

    on(evento, tratador) {
      this.tratadores[evento] = tratador;
      return this;
    }
  }
  return { Pool: PoolFalso, instancias };
}

// Tudo o que um erro pode revelar: mensagem, stack, JSON e o que o console.error imprime (util.inspect).
function textosDoErro(erro) {
  return [erro.message, erro.stack, String(erro), JSON.stringify(erro), inspect(erro, { depth: 5 })];
}

function esperarSemSegredos(textos) {
  for (const texto of textos) {
    for (const segredo of SEGREDOS) {
      expect(texto, `não pode conter "${segredo}"`).not.toContain(segredo);
    }
  }
}

function erroDe(funcao) {
  try {
    funcao();
  } catch (erro) {
    return erro;
  }
  throw new Error("era esperado um erro");
}

let saidaConsola;
beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("DATABASE_CA_CERT", "");
  saidaConsola = [];
  for (const metodo of ["log", "info", "warn", "error", "debug"]) {
    vi.spyOn(console, metodo).mockImplementation((...args) => saidaConsola.push(args.map((a) => inspect(a)).join(" ")));
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("criarLigacao — não liga sem endereço", () => {
  it("recusa quando não há DATABASE_URL nem endereço passado, e explica o que falta", () => {
    const { Pool, instancias } = criarPoolFalso();

    const erro = erroDe(() => criarLigacao({ caCert: CERTIFICADO, Pool }));

    expect(erro).toBeInstanceOf(ErroLigacao);
    expect(erro.codigo).toBe(CODIGOS_LIGACAO.SEM_ENDERECO);
    expect(erro.message).toContain("DATABASE_URL");
    expect(instancias).toHaveLength(0);
  });

  it.each([
    ["que não é um URL", `postgres://${UTILIZADOR}:${PALAVRA_PASSE}@:::invalido`],
    ["de outro protocolo", `https://${UTILIZADOR}:${PALAVRA_PASSE}@${SERVIDOR}/defaultdb`],
    ["sem utilizador e palavra-passe", `postgres://${SERVIDOR}:12345/defaultdb`],
  ])("recusa um endereço %s", (_descricao, databaseUrl) => {
    const { Pool, instancias } = criarPoolFalso();

    const erro = erroDe(() => criarLigacao({ databaseUrl, caCert: CERTIFICADO, Pool }));

    expect(erro).toBeInstanceOf(ErroLigacao);
    expect(erro.codigo).toBe(CODIGOS_LIGACAO.ENDERECO_INVALIDO);
    expect(erro.message).toContain("DATABASE_URL");
    expect(instancias).toHaveLength(0);
  });
});

describe("criarLigacao — não liga sem certificado", () => {
  it("recusa quando não há DATABASE_CA_CERT nem certificado passado, e explica o que falta", () => {
    const { Pool, instancias } = criarPoolFalso();

    const erro = erroDe(() => criarLigacao({ databaseUrl: ENDERECO, Pool }));

    expect(erro).toBeInstanceOf(ErroLigacao);
    expect(erro.codigo).toBe(CODIGOS_LIGACAO.SEM_CERTIFICADO);
    expect(erro.message).toContain("DATABASE_CA_CERT");
    expect(instancias).toHaveLength(0);
  });

  it("recusa um texto que não é um certificado PEM", () => {
    const { Pool, instancias } = criarPoolFalso();

    const erro = erroDe(() => criarLigacao({ databaseUrl: ENDERECO, caCert: "não sou um certificado", Pool }));

    expect(erro.codigo).toBe(CODIGOS_LIGACAO.CERTIFICADO_INVALIDO);
    expect(erro.message).toContain("DATABASE_CA_CERT");
    expect(instancias).toHaveLength(0);
  });
});

describe("nunca mostra o endereço, o utilizador nem a palavra-passe", () => {
  it.each([
    ["endereço em falta", { caCert: CERTIFICADO }],
    ["endereço que não é um URL", { databaseUrl: `postgres://${UTILIZADOR}:${PALAVRA_PASSE}@:::invalido`, caCert: CERTIFICADO }],
    ["endereço de outro protocolo", { databaseUrl: `https://${UTILIZADOR}:${PALAVRA_PASSE}@${SERVIDOR}/db`, caCert: CERTIFICADO }],
    ["certificado em falta", { databaseUrl: ENDERECO }],
    ["certificado inválido", { databaseUrl: ENDERECO, caCert: "inválido" }],
  ])("no erro de %s", (_descricao, opcoes) => {
    const { Pool } = criarPoolFalso();

    const erro = erroDe(() => criarLigacao({ ...opcoes, Pool }));

    expect(erro).toBeInstanceOf(ErroLigacao);
    esperarSemSegredos(textosDoErro(erro));
    esperarSemSegredos(saidaConsola);
  });

  it("no erro de autenticação devolvido pelo PostgreSQL, sem perder o código do erro", async () => {
    const { Pool } = criarPoolFalso();
    const pool = criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, Pool });
    const erroPg = Object.assign(new Error(`password authentication failed for user "${UTILIZADOR}" at ${SERVIDOR}`), { code: "28P01" });
    pool.query.mockRejectedValue(erroPg);

    const erro = await verificarLigacao(pool).catch((e) => e);

    expect(erro).toBeInstanceOf(ErroLigacao);
    expect(erro.codigo).toBe(CODIGOS_LIGACAO.FALHA_LIGACAO);
    expect(erro.codigoPostgres).toBe("28P01");
    expect(erro.message).toContain("28P01");
    esperarSemSegredos(textosDoErro(erro));
    esperarSemSegredos(saidaConsola);
  });

  it("no registo de erros que o pool emite em ligações já abertas", () => {
    const { Pool, instancias } = criarPoolFalso();
    criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, Pool });

    instancias[0].tratadores.error(new Error(`connection to ${SERVIDOR} lost; user "${UTILIZADOR}" password ${PALAVRA_PASSE}`));

    expect(saidaConsola.length).toBeGreaterThan(0);
    esperarSemSegredos(saidaConsola);
  });

  it("no objeto do pool real do pg: a palavra-passe não é enumerável", async () => {
    const pool = criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO });
    try {
      expect(JSON.stringify(pool.options)).not.toContain(PALAVRA_PASSE);
      expect(inspect(pool.options)).not.toContain(PALAVRA_PASSE);
    } finally {
      await pool.end();
    }
  });
});

describe("criarLigacao — ligação sempre cifrada e com o certificado verificado", () => {
  it("passa ao pool os dados do endereço em campos separados, com SSL verificado", () => {
    const { Pool, instancias } = criarPoolFalso();

    criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, Pool });

    expect(instancias).toHaveLength(1);
    const configuracao = instancias[0].configuracao;
    expect(configuracao).toMatchObject({ host: SERVIDOR, port: 12345, database: "defaultdb", user: UTILIZADOR, password: PALAVRA_PASSE });
    expect(configuracao.ssl).toEqual({ ca: CERTIFICADO, rejectUnauthorized: true });
    expect(configuracao).not.toHaveProperty("connectionString");
  });

  it.each([
    "sslmode=disable",
    "sslmode=no-verify",
    "sslmode=prefer",
    "sslmode=require",
    "sslmode=verify-full",
    "sslmode=no-verify&sslrootcert=/tmp/outra-ca.pem&sslcert=/tmp/c.pem&sslkey=/tmp/k.pem",
  ])("ignora %s no endereço e mantém a verificação do certificado", (parametros) => {
    const { Pool, instancias } = criarPoolFalso();
    const databaseUrl = `postgres://${UTILIZADOR}:${encodeURIComponent(PALAVRA_PASSE)}@${SERVIDOR}:12345/defaultdb?${parametros}`;

    criarLigacao({ databaseUrl, caCert: CERTIFICADO, Pool });

    const configuracao = instancias[0].configuracao;
    expect(configuracao.ssl).toEqual({ ca: CERTIFICADO, rejectUnauthorized: true });
    expect(JSON.stringify(configuracao)).not.toMatch(/sslmode|sslrootcert|sslcert|sslkey|no-verify/);
  });

  it("aceita o prefixo postgresql:// e usa a porta 5432 quando o endereço não a indica", () => {
    const { Pool, instancias } = criarPoolFalso();

    criarLigacao({ databaseUrl: `postgresql://${UTILIZADOR}:x@${SERVIDOR}/defaultdb`, caCert: CERTIFICADO, Pool });

    expect(instancias[0].configuracao.port).toBe(5432);
  });

  it("o pool real do pg fica com rejectUnauthorized: true e o certificado indicado", async () => {
    const pool = criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO });
    try {
      expect(pool.options.ssl.rejectUnauthorized).toBe(true);
      expect(pool.options.ssl.ca).toBe(CERTIFICADO);
      expect(pool.options).not.toHaveProperty("connectionString");
    } finally {
      await pool.end();
    }
  });
});

describe("criarLigacao — origem do endereço e do certificado", () => {
  it("lê DATABASE_URL e DATABASE_CA_CERT do ambiente quando não são passados", () => {
    vi.stubEnv("DATABASE_URL", ENDERECO);
    vi.stubEnv("DATABASE_CA_CERT", CERTIFICADO);
    const { Pool, instancias } = criarPoolFalso();

    criarLigacao({ Pool });

    expect(instancias[0].configuracao.host).toBe(SERVIDOR);
    expect(instancias[0].configuracao.ssl.ca).toBe(CERTIFICADO);
  });

  it("dá prioridade aos valores passados ao módulo", () => {
    vi.stubEnv("DATABASE_URL", `postgres://outro:x@outro-servidor.exemplo/db`);
    vi.stubEnv("DATABASE_CA_CERT", "inválido");
    const { Pool, instancias } = criarPoolFalso();

    criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, Pool });

    expect(instancias[0].configuracao.host).toBe(SERVIDOR);
    expect(instancias[0].configuracao.ssl.ca).toBe(CERTIFICADO);
  });

  it("converte os \\n escritos como texto no certificado em quebras de linha reais", () => {
    const { Pool, instancias } = criarPoolFalso();

    criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO.replaceAll("\n", "\\n"), Pool });

    expect(instancias[0].configuracao.ssl.ca).toBe(CERTIFICADO);
  });
});

describe("verificarLigacao", () => {
  it("corre uma consulta simples e termina sem erro quando a base de dados responde", async () => {
    const { Pool } = criarPoolFalso();
    const pool = criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, Pool });
    pool.query.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    await expect(verificarLigacao(pool)).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith("SELECT 1");
  });
});

describe("criarLigacao — nome da variável nas mensagens", () => {
  it("refere a variável indicada (ex.: DATABASE_ADMIN_URL) quando o endereço falta", () => {
    const { Pool } = criarPoolFalso();

    const erro = erroDe(() => criarLigacao({ databaseUrl: "", caCert: CERTIFICADO, nomeVariavelEndereco: "DATABASE_ADMIN_URL", Pool }));

    expect(erro.codigo).toBe(CODIGOS_LIGACAO.SEM_ENDERECO);
    expect(erro.message).toContain("DATABASE_ADMIN_URL");
    expect(erro.message).not.toMatch(/\bDATABASE_URL\b/);
  });

  it("refere a variável indicada quando o endereço é inválido", () => {
    const { Pool } = criarPoolFalso();

    const erro = erroDe(() => criarLigacao({ databaseUrl: "https://x", caCert: CERTIFICADO, nomeVariavelEndereco: "DATABASE_ADMIN_URL", Pool }));

    expect(erro.message).toContain("DATABASE_ADMIN_URL");
  });
});

describe("mensagemSegura", () => {
  it("limpa de uma mensagem de erro qualquer o endereço, o utilizador, a palavra-passe e o servidor deste pool", () => {
    const { Pool } = criarPoolFalso();
    const pool = criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, Pool });
    const erro = Object.assign(new Error(`role "${UTILIZADOR}" at ${SERVIDOR} with ${PALAVRA_PASSE} via ${ENDERECO}`), { code: "42501" });

    const texto = mensagemSegura(pool, erro);

    expect(texto).toContain("42501");
    esperarSemSegredos([texto]);
  });
});

describe("mensagemSegura — erros de rede agregados", () => {
  it("usa as mensagens internas de um AggregateError sem mensagem (ex.: IPv6 e IPv4 recusados), sem segredos", () => {
    const { Pool } = criarPoolFalso();
    const pool = criarLigacao({ databaseUrl: ENDERECO, caCert: CERTIFICADO, Pool });
    const erro = Object.assign(
      new AggregateError([new Error(`connect ECONNREFUSED ${SERVIDOR}:12345`), new Error(`connect ETIMEDOUT ${SERVIDOR}:12345`)], ""),
      { code: "ECONNREFUSED" },
    );

    const texto = mensagemSegura(pool, erro);

    expect(texto).toContain("ECONNREFUSED");
    expect(texto).toContain("ETIMEDOUT");
    expect(texto).not.toContain("sem detalhe");
    esperarSemSegredos([texto]);
  });
});
