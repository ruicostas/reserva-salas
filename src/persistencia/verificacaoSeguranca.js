// Verifica, numa ligação real, que a ligação é segura e que o utilizador da aplicação tem só as permissões previstas.
// Tudo o que escreve na base de dados fica dentro de uma transação que é sempre anulada (ROLLBACK): nada fica gravado.
import { UTILIZADOR_APP } from "./esquema.js";
import { mensagemSegura } from "./ligacao.js";

export const CONSULTA_SESSAO = "SELECT current_user AS utilizador, session_user AS utilizador_sessao";
export const CONSULTA_SSL_SERVIDOR = "SELECT ssl, version AS versao, cipher AS cifra FROM pg_stat_ssl WHERE pid = pg_backend_pid()";
// Limites curtos: se outra transação tiver a tabela bloqueada, o teste desiste em vez de prender a aplicação.
const LIMITES_DE_ESPERA = "SET LOCAL lock_timeout = '3s'; SET LOCAL statement_timeout = '15s'";
export const GRAVAR_RESERVA_TESTE = `
INSERT INTO reservas (sala_id, inicio, fim, numero_pessoas)
SELECT id, $1::timestamptz, $2::timestamptz, 1 FROM salas ORDER BY nome LIMIT 1
RETURNING id`.trim();
export const CONSULTA_RESERVA_TESTE = "SELECT count(*)::int AS total FROM reservas WHERE id = $1";
export const CONSULTA_TABELA_EXISTE = "SELECT to_regclass('public.reservas') IS NOT NULL AS existe";

// Data longe no futuro, para não chocar com reservas reais (a regra de sobreposição também vale na base de dados).
const INICIO_TESTE = "2999-12-31T22:00:00Z";
const FIM_TESTE = "2999-12-31T23:00:00Z";
const PROTOCOLOS_SEGUROS = Object.freeze(["TLSv1.2", "TLSv1.3"]);
const SEM_PERMISSAO = "42501";

export class ErroVerificacao extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroVerificacao";
  }
}

// Estado do TLS visto pela aplicação: o pg substitui o socket pelo TLSSocket do Node depois de negociar o SSL.
// Do certificado só se mostra quem o emitiu e a validade; o "subject" traz o nome do servidor, que faz parte do endereço.
function lerTls(socket) {
  const ehTls = socket?.encrypted === true && typeof socket.getCipher === "function";
  if (!ehTls) {
    return { cifrada: false, protocolo: null, cifra: null, certificadoConfirmado: false, erroCertificado: null, emissor: null, validoAte: null };
  }
  const cifra = socket.getCipher();
  const certificado = socket.getPeerCertificate?.() ?? {};
  const emissor = certificado.issuer ? [certificado.issuer.CN, certificado.issuer.O].filter(Boolean).join(", ") : null;
  return {
    cifrada: true,
    protocolo: socket.getProtocol?.() ?? null,
    cifra: cifra?.standardName ?? cifra?.name ?? null,
    certificadoConfirmado: socket.authorized === true,
    erroCertificado: socket.authorizationError ? String(socket.authorizationError) : null,
    emissor,
    validoAte: certificado.valid_to ?? null,
  };
}

// Corre uma operação num SAVEPOINT e volta sempre atrás logo a seguir, tenha resultado ou não.
async function tentarEDesfazer(cliente, nomeSavepoint, operacao) {
  await cliente.query(`SAVEPOINT ${nomeSavepoint}`);
  try {
    return { ok: true, resultado: await operacao() };
  } catch (erro) {
    return { ok: false, erro };
  } finally {
    await cliente.query(`ROLLBACK TO SAVEPOINT ${nomeSavepoint}`);
  }
}

function verificacaoGravar(pool, gravacao) {
  const descricao = "Consegue gravar uma reserva";
  if (!gravacao.ok) {
    return { descricao, ok: false, detalhe: `recusado (${mensagemSegura(pool, gravacao.erro)})` };
  }
  const id = gravacao.resultado?.rows?.[0]?.id;
  if (!id) {
    return { descricao, ok: false, detalhe: "não há salas na base de dados; corra primeiro npm run migrar" };
  }
  return { descricao, ok: true, detalhe: `reserva de teste ${id} gravada em 31/12/2999, das 22:00 às 23:00 UTC` };
}

function verificacaoApagar(pool, apagar) {
  const descricao = "Não consegue apagar a tabela reservas";
  if (apagar.ok) {
    return {
      descricao,
      ok: false,
      detalhe: `o utilizador CONSEGUIU apagar a tabela (a anulação repôs-a); retire-lhe esta permissão`,
    };
  }
  if (apagar.erro?.code === SEM_PERMISSAO) {
    return { descricao, ok: true, detalhe: `recusado pelo PostgreSQL (${mensagemSegura(pool, apagar.erro)})` };
  }
  return { descricao, ok: false, detalhe: `recusado, mas por outro motivo; não fica provado (${mensagemSegura(pool, apagar.erro)})` };
}

/**
 * Liga, recolhe o estado do TLS e corre os testes de permissões numa transação anulada no fim.
 * Devolve { ok, tls, servidor, utilizador, verificacoes: [{ descricao, ok, detalhe }] }.
 * Lança ErroVerificacao (sem credenciais) se a ligação falhar a meio; nesse caso nada fica gravado.
 */
export async function verificarSeguranca(pool) {
  const cliente = await pool.connect();
  let passo = "leitura da sessão";
  let transacaoAberta = false;
  try {
    const tls = lerTls(cliente.connection?.stream);
    const { rows: [sessao] } = await cliente.query(CONSULTA_SESSAO);
    passo = "leitura do SSL no servidor";
    const { rows: [ssl] } = await cliente.query(CONSULTA_SSL_SERVIDOR);
    const servidor = { ssl: ssl?.ssl === true, versao: ssl?.versao ?? null, cifra: ssl?.cifra ?? null };

    passo = "início da transação de teste";
    await cliente.query("BEGIN");
    transacaoAberta = true;
    await cliente.query(LIMITES_DE_ESPERA);
    passo = "gravação da reserva de teste";
    const gravacao = await tentarEDesfazer(cliente, "antes_de_gravar", () => cliente.query(GRAVAR_RESERVA_TESTE, [INICIO_TESTE, FIM_TESTE]));
    passo = "tentativa de apagar a tabela reservas";
    const apagar = await tentarEDesfazer(cliente, "antes_de_apagar", () => cliente.query("DROP TABLE reservas"));
    passo = "anulação da transação de teste";
    await cliente.query("ROLLBACK");
    transacaoAberta = false;

    passo = "confirmação de que nada ficou gravado";
    const idTeste = gravacao.resultado?.rows?.[0]?.id ?? null;
    const restantes = idTeste ? (await cliente.query(CONSULTA_RESERVA_TESTE, [idTeste])).rows[0]?.total : 0;
    const { rows: [tabela] } = await cliente.query(CONSULTA_TABELA_EXISTE);

    const protocoloSeguro = PROTOCOLOS_SEGUROS.includes(tls.protocolo);
    const verificacoes = [
      { descricao: "Ligação estabelecida", ok: true, detalhe: "a base de dados respondeu" },
      { descricao: "Ligação cifrada (TLS)", ok: tls.cifrada, detalhe: tls.cifrada ? `cifra ${tls.cifra}` : "a ligação não usa TLS" },
      { descricao: "Protocolo seguro (TLS 1.2 ou superior)", ok: protocoloSeguro, detalhe: tls.protocolo ?? "sem TLS" },
      {
        descricao: "Certificado do servidor confirmado pela CA do Aiven",
        ok: tls.certificadoConfirmado,
        detalhe: tls.certificadoConfirmado ? `emitido por ${tls.emissor}, válido até ${tls.validoAte}` : (tls.erroCertificado ?? "não confirmado"),
      },
      {
        descricao: "O servidor confirma que a sessão está cifrada",
        ok: servidor.ssl,
        detalhe: servidor.ssl ? `${servidor.versao}, ${servidor.cifra}` : "pg_stat_ssl indica ssl = false",
      },
      { descricao: `Entrou como ${UTILIZADOR_APP}`, ok: sessao?.utilizador === UTILIZADOR_APP, detalhe: `utilizador: ${sessao?.utilizador}` },
      verificacaoGravar(pool, gravacao),
      verificacaoApagar(pool, apagar),
      {
        descricao: "Nada ficou gravado (transação anulada)",
        ok: restantes === 0,
        detalhe: restantes === 0 ? "a reserva de teste não existe depois do ROLLBACK" : "a reserva de teste ainda existe!",
      },
      { descricao: "A tabela reservas continua a existir", ok: tabela?.existe === true, detalhe: tabela?.existe === true ? "sim" : "não!" },
    ];

    return { ok: verificacoes.every((v) => v.ok), tls, servidor, utilizador: sessao?.utilizador ?? null, verificacoes };
  } catch (erro) {
    if (transacaoAberta) {
      await cliente.query("ROLLBACK").catch(() => {});
    }
    throw new ErroVerificacao(`Falhou o passo "${passo}" (${mensagemSegura(pool, erro)}). Nada ficou gravado: nenhuma transação foi confirmada.`);
  } finally {
    // true: a ligação é destruída em vez de voltar ao pool, para não herdar nenhum estado da sessão de teste.
    cliente.release(true);
  }
}

export function formatarRelatorio(relatorio) {
  const { tls } = relatorio;
  const linhas = [
    "Ligação à base de dados",
    `  Utilizador:  ${relatorio.utilizador}`,
    `  Cifra:       ${tls.cifrada ? `${tls.cifra} (${tls.protocolo})` : "nenhuma"}`,
    `  Certificado: ${tls.emissor ? `emitido por ${tls.emissor}, válido até ${tls.validoAte}` : "sem informação"}`,
    "",
    ...relatorio.verificacoes.map((v) => `${v.ok ? "✓" : "✗"} ${v.descricao}${v.detalhe ? ` — ${v.detalhe}` : ""}`),
    "",
    relatorio.ok ? "Resultado: SEGURA — todas as verificações passaram." : "Resultado: FALHOU — reveja as linhas com ✗.",
  ];
  return linhas.join("\n");
}
