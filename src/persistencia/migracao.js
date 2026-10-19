// Executa a migração do esquema numa só transação: ou fica tudo aplicado, ou nada muda.
import {
  CONSULTA_ATRIBUTOS_APP,
  CONSULTA_GRUPOS_APP,
  CONSULTA_UTILIZADOR_APP_EXISTE,
  INSTRUCOES_MIGRACAO,
  PRIVILEGIOS_ESPERADOS,
  UTILIZADOR_APP,
  VERIFICACAO_PRIVILEGIOS,
} from "./esquema.js";
import { mensagemSegura } from "./ligacao.js";

export const CODIGOS_MIGRACAO = Object.freeze({
  UTILIZADOR_APP_EM_FALTA: "MIGRACAO_UTILIZADOR_APP_EM_FALTA",
  INSTRUCAO_FALHOU: "MIGRACAO_INSTRUCAO_FALHOU",
  PERMISSOES_INCORRETAS: "MIGRACAO_PERMISSOES_INCORRETAS",
});

const ATRIBUTOS_ESPECIAIS = Object.freeze({
  rolsuper: "SUPERUSER",
  rolcreatedb: "CREATEDB",
  rolcreaterole: "CREATEROLE",
  rolreplication: "REPLICATION",
  rolbypassrls: "BYPASSRLS",
});

export class ErroMigracao extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.name = "ErroMigracao";
    this.codigo = codigo;
  }
}

function descreverPermissao(valor) {
  if (valor === undefined) {
    return "sem resposta";
  }
  return valor ? "sim" : "não";
}

// Compara as permissões efetivas com as esperadas; devolve as diferenças em texto.
function diferencasDePermissoes(linhas) {
  const obtidas = new Map(linhas.map((linha) => [linha.nome, linha.tem]));
  return Object.entries(PRIVILEGIOS_ESPERADOS)
    .filter(([nome, esperado]) => obtidas.get(nome) !== esperado)
    .map(([nome, esperado]) => `${nome}: esperado ${descreverPermissao(esperado)}, obtido ${descreverPermissao(obtidas.get(nome))}`);
}

// Atributos e grupos que a migração não controla (definidos na consola do Aiven): só avisa.
async function avisosSobreUtilizador(cliente) {
  const avisos = [];
  const { rows: atributos } = await cliente.query(CONSULTA_ATRIBUTOS_APP, [UTILIZADOR_APP]);
  for (const [coluna, nome] of Object.entries(ATRIBUTOS_ESPECIAIS)) {
    if (atributos[0]?.[coluna] === true) {
      avisos.push(`${UTILIZADOR_APP} tem o atributo ${nome}, que lhe dá permissões além das tabelas; retire-o na consola do Aiven.`);
    }
  }
  const { rows: grupos } = await cliente.query(CONSULTA_GRUPOS_APP, [UTILIZADOR_APP]);
  for (const { grupo } of grupos) {
    avisos.push(`${UTILIZADOR_APP} pertence ao grupo ${grupo} e herda as permissões dele; confirme se é necessário.`);
  }
  return avisos;
}

/**
 * Aplica o esquema, as salas de exemplo e as permissões de app_reservas, e confirma as permissões efetivas antes do COMMIT.
 * Devolve { salasCriadas, avisos }. Em caso de erro desfaz tudo (ROLLBACK) e lança ErroMigracao sem credenciais.
 *
 * @param {import("pg").Pool} pool Pool criado com criarLigacao (para as mensagens de erro serem limpas).
 * @param {{ registar?: (texto: string) => void }} [opcoes]
 */
export async function executarMigracao(pool, { registar = console.log } = {}) {
  const cliente = await pool.connect();
  let passo = "início da transação";
  try {
    await cliente.query("BEGIN");

    passo = `verificação do utilizador ${UTILIZADOR_APP}`;
    const existe = await cliente.query(CONSULTA_UTILIZADOR_APP_EXISTE, [UTILIZADOR_APP]);
    if (existe.rowCount === 0) {
      throw new ErroMigracao(
        CODIGOS_MIGRACAO.UTILIZADOR_APP_EM_FALTA,
        `O utilizador ${UTILIZADOR_APP} não existe. Crie-o na consola do Aiven (serviço PostgreSQL → Users → Add service user) ` +
          `e volte a correr "npm run migrar". Nada foi alterado.`,
      );
    }

    let salasCriadas = 0;
    for (const instrucao of INSTRUCOES_MIGRACAO) {
      passo = instrucao.descricao;
      registar(`→ ${instrucao.descricao}`);
      const resultado = await cliente.query(instrucao.sql, instrucao.parametros);
      if (instrucao.contaSalasCriadas) {
        salasCriadas = resultado.rowCount ?? 0;
      }
    }

    passo = `verificação das permissões de ${UTILIZADOR_APP}`;
    registar(`→ ${passo}`);
    const { rows } = await cliente.query(VERIFICACAO_PRIVILEGIOS, [UTILIZADOR_APP]);
    const diferencas = diferencasDePermissoes(rows);
    if (diferencas.length > 0) {
      throw new ErroMigracao(
        CODIGOS_MIGRACAO.PERMISSOES_INCORRETAS,
        `As permissões de ${UTILIZADOR_APP} não ficaram como esperado, por isso nada foi alterado:\n  - ${diferencas.join("\n  - ")}`,
      );
    }

    passo = `verificação dos atributos de ${UTILIZADOR_APP}`;
    const avisos = await avisosSobreUtilizador(cliente);
    for (const aviso of avisos) {
      registar(`⚠ ${aviso}`);
    }

    passo = "confirmação da transação";
    await cliente.query("COMMIT");
    return { salasCriadas, avisos };
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => {});
    if (erro instanceof ErroMigracao) {
      throw erro;
    }
    throw new ErroMigracao(CODIGOS_MIGRACAO.INSTRUCAO_FALHOU, `Falhou o passo "${passo}"; nada foi alterado (${mensagemSegura(pool, erro)}).`);
  } finally {
    cliente.release();
  }
}
