// Ligação à base de dados PostgreSQL no Aiven. Só para o servidor (e testes/scripts): lê variáveis de ambiente com credenciais.
// Regras: a ligação é sempre cifrada e verifica o certificado do Aiven; o endereço, o utilizador e a palavra-passe nunca
// aparecem em mensagens nem em registos.
import pg from "pg";

export const CODIGOS_LIGACAO = Object.freeze({
  SEM_ENDERECO: "LIGACAO_SEM_ENDERECO",
  ENDERECO_INVALIDO: "LIGACAO_ENDERECO_INVALIDO",
  SEM_CERTIFICADO: "LIGACAO_SEM_CERTIFICADO",
  CERTIFICADO_INVALIDO: "LIGACAO_CERTIFICADO_INVALIDO",
  FALHA_LIGACAO: "LIGACAO_FALHOU",
});

const PREFIXO = "Não foi possível ligar à base de dados";
const PORTA_POR_OMISSAO = 5432;
const PEM = /^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/;
// Códigos de erro do PostgreSQL (SQLSTATE) têm 5 caracteres, ex.: 28P01 = palavra-passe errada.
const SQLSTATE = /^[0-9A-Z]{5}$/;

// Erro com mensagem segura. Nunca guarda o erro original (cause): o pg pode pôr o utilizador ou o servidor na mensagem dele.
export class ErroLigacao extends Error {
  constructor(codigo, mensagem, extras = {}) {
    super(mensagem);
    this.name = "ErroLigacao";
    this.codigo = codigo;
    Object.assign(this, extras);
  }
}

// Segredos de cada pool, para limpar as mensagens de erro que o pg devolve. WeakMap: não fica visível no objeto do pool.
const segredosPorPool = new WeakMap();

function ocultar(texto, segredos) {
  let limpo = String(texto ?? "");
  for (const segredo of segredos) {
    if (segredo) {
      limpo = limpo.replaceAll(segredo, "***");
    }
  }
  return limpo || "sem detalhe";
}

function enderecoInvalido(motivo, nomeVariavel) {
  return new ErroLigacao(CODIGOS_LIGACAO.ENDERECO_INVALIDO, `${PREFIXO}: o endereço em ${nomeVariavel} ${motivo}.`);
}

function descodificar(texto, nomeVariavel) {
  try {
    return decodeURIComponent(texto);
  } catch {
    throw enderecoInvalido("tem caracteres mal codificados", nomeVariavel);
  }
}

// Lê o endereço em campos separados. Os parâmetros do endereço (sslmode, sslrootcert, ...) são ignorados de propósito:
// no pg, os parâmetros de um connectionString sobrepõem-se à configuração e poderiam desligar a verificação do certificado.
function lerEndereco(databaseUrl, nomeVariavel) {
  if (!databaseUrl) {
    throw new ErroLigacao(
      CODIGOS_LIGACAO.SEM_ENDERECO,
      `${PREFIXO}: falta o endereço. Defina a variável de ambiente ${nomeVariavel} (ou passe databaseUrl ao módulo).`,
    );
  }

  let url = null;
  try {
    url = new URL(databaseUrl);
  } catch {
    // O TypeError do URL guarda o texto original (input): é descartado aqui.
  }
  if (url === null) {
    throw enderecoInvalido("não é um URL válido", nomeVariavel);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw enderecoInvalido("tem de começar por postgres:// ou postgresql://", nomeVariavel);
  }
  if (url.hostname === "") {
    throw enderecoInvalido("não indica o servidor", nomeVariavel);
  }
  if (url.username === "" || url.password === "") {
    throw enderecoInvalido("não indica o utilizador e a palavra-passe", nomeVariavel);
  }

  const ligacao = {
    host: url.hostname,
    port: url.port === "" ? PORTA_POR_OMISSAO : Number(url.port),
    database: descodificar(url.pathname.slice(1), nomeVariavel) || undefined,
    user: descodificar(url.username, nomeVariavel),
    password: descodificar(url.password, nomeVariavel),
  };
  // Do mais comprido para o mais curto, para o endereço completo ser substituído antes das partes.
  const segredos = [databaseUrl, url.password, ligacao.password, url.username, ligacao.user, url.hostname].sort((a, b) => b.length - a.length);
  return { ligacao, segredos };
}

// Aceita o PEM com quebras de linha reais ou escritas como "\n" (comum em variáveis de ambiente, ex.: na Vercel).
function lerCertificado(caCert) {
  const pem = String(caCert ?? "").replaceAll("\\n", "\n").trim();
  if (pem === "") {
    throw new ErroLigacao(
      CODIGOS_LIGACAO.SEM_CERTIFICADO,
      `${PREFIXO}: falta o certificado do Aiven. Defina a variável de ambiente DATABASE_CA_CERT com o conteúdo do ficheiro ca.pem ` +
        "(ou passe caCert ao módulo).",
    );
  }
  if (!PEM.test(pem)) {
    throw new ErroLigacao(
      CODIGOS_LIGACAO.CERTIFICADO_INVALIDO,
      `${PREFIXO}: DATABASE_CA_CERT não contém um certificado PEM (texto entre -----BEGIN CERTIFICATE----- e -----END CERTIFICATE-----).`,
    );
  }
  return pem;
}

function descricaoDoCodigo(erro) {
  return erro?.code ? ` (código ${erro.code})` : "";
}

/**
 * Cria o pool de ligações. Não abre nenhuma ligação: o pg só liga na primeira consulta (ver verificarLigacao).
 * Lança ErroLigacao, sem nunca revelar credenciais, se faltar o endereço ou o certificado.
 *
 * nomeVariavelEndereco só muda o nome da variável referido nas mensagens (ex.: "DATABASE_ADMIN_URL" no script de migração).
 *
 * @param {{ databaseUrl?: string, caCert?: string, nomeVariavelEndereco?: string, Pool?: typeof pg.Pool }} [opcoes]
 */
export function criarLigacao({
  databaseUrl = process.env.DATABASE_URL,
  caCert = process.env.DATABASE_CA_CERT,
  nomeVariavelEndereco = "DATABASE_URL",
  Pool = pg.Pool,
} = {}) {
  const { ligacao, segredos } = lerEndereco(databaseUrl, nomeVariavelEndereco);
  const ca = lerCertificado(caCert);

  // Sempre cifrada e com o certificado verificado contra a CA do Aiven; nunca rejectUnauthorized: false.
  const pool = new Pool({ ...ligacao, ssl: { ca, rejectUnauthorized: true } });
  segredosPorPool.set(pool, segredos);

  // Sem este tratador, um erro numa ligação inativa terminaria o processo; a mensagem é limpa antes de ser registada.
  pool.on("error", (erro) => {
    console.error(`[persistência] Erro numa ligação à base de dados${descricaoDoCodigo(erro)}: ${ocultar(erro?.message, segredos)}`);
  });

  return pool;
}

// Texto seguro para mostrar ou registar um erro qualquer vindo deste pool: código e mensagem sem credenciais nem servidor.
export function mensagemSegura(pool, erro) {
  const codigo = erro?.code ? `código ${erro.code}: ` : "";
  // Um AggregateError (ex.: IPv6 e IPv4 recusados ao ligar) vem sem mensagem própria; usam-se as dos erros internos.
  const internas = Array.isArray(erro?.errors) ? erro.errors.map((interno) => interno?.message).filter(Boolean).join("; ") : "";
  return `${codigo}${ocultar(erro?.message || internas, segredosPorPool.get(pool) ?? [])}`;
}

/**
 * Confirma que a base de dados responde (SELECT 1). Devolve true; em caso de falha lança ErroLigacao com a mensagem limpa
 * e o código original (codigoPostgres para erros do PostgreSQL, codigoSistema para erros de rede como ENOTFOUND).
 */
export async function verificarLigacao(pool) {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (erro) {
    const codigo = erro?.code;
    const extras = codigo ? { [SQLSTATE.test(codigo) ? "codigoPostgres" : "codigoSistema"]: codigo } : {};
    throw new ErroLigacao(CODIGOS_LIGACAO.FALHA_LIGACAO, `${PREFIXO} (${mensagemSegura(pool, erro)})`, extras);
  }
}
