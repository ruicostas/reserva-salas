// Contrato do repositório contra a base de dados PostgreSQL real (DATABASE_URL e DATABASE_CA_CERT do .env.local).
// Corre só com "npm run test:postgres" (ou TESTES_POSTGRES=1); o "npm run test" normal não toca na base de dados.
// Dados de teste: cada teste cria salas próprias com o prefixo [teste-contrato] e apaga-as no fim, com as suas reservas.
// Antes e depois da suite apagam-se também restos de execuções interrompidas. As reservas reais nunca são tocadas.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe } from "vitest";
import { testarContratoRepositorio } from "./contratoRepositorio.js";
import { criarLigacao, mensagemSegura, verificarLigacao } from "./ligacao.js";

const PREFIXO_TESTE = "[teste-contrato]";

// Caminho numa variável: o Vite não tenta resolver o ficheiro enquanto ele não existir.
const CAMINHO_REPOSITORIO = "./repositorioPostgres.js";
const modulo = await import(/* @vite-ignore */ CAMINHO_REPOSITORIO).catch(() => null);

// Só corre quando pedido (npm run test:postgres, ou TESTES_POSTGRES=1): escreve e apaga dados de teste na base de dados real.
function motivoParaIgnorar() {
  if (process.env.TESTES_POSTGRES !== "1") {
    return "só corre com npm run test:postgres (ou TESTES_POSTGRES=1)";
  }
  if (!process.env.DATABASE_URL) {
    return "falta DATABASE_URL no .env.local";
  }
  if (typeof modulo?.criarRepositorioPostgres !== "function") {
    return "src/persistencia/repositorioPostgres.js ainda não existe";
  }
  return null;
}

const motivo = motivoParaIgnorar();

// As consultas de preparação e limpeza também não podem deixar sair o erro do pg tal como vem (traz o utilizador).
async function consultar(pool, sql, parametros) {
  try {
    return await pool.query(sql, parametros);
  } catch (erro) {
    throw new Error(`Falhou a preparação dos dados de teste no PostgreSQL (${mensagemSegura(pool, erro)})`);
  }
}

// A condição é sempre um dos dois textos fixos usados abaixo; os valores vão como parâmetros.
async function apagarDadosDeTeste(pool, condicao, parametros) {
  await consultar(pool, `DELETE FROM reservas WHERE sala_id IN (SELECT id FROM salas WHERE ${condicao})`, parametros);
  await consultar(pool, `DELETE FROM salas WHERE ${condicao}`, parametros);
}

describe.skipIf(motivo)(`PostgreSQL${motivo ? ` (ignorado: ${motivo})` : ""}`, () => {
  let pool;
  let ligado = false;

  beforeAll(async () => {
    pool = criarLigacao();
    await verificarLigacao(pool);
    ligado = true;
    await apagarDadosDeTeste(pool, "starts_with(nome, $1)", [PREFIXO_TESTE]);
  });

  afterAll(async () => {
    if (!pool) {
      return;
    }
    try {
      // Sem ligação não houve dados de teste; tentar limpar só juntaria um segundo erro igual ao primeiro.
      if (ligado) {
        await apagarDadosDeTeste(pool, "starts_with(nome, $1)", [PREFIXO_TESTE]);
      }
    } finally {
      await pool.end();
    }
  });

  testarContratoRepositorio("PostgreSQL", async () => {
    const execucao = randomUUID();
    const { rows: salas } = await consultar(
      pool,
      `INSERT INTO salas (nome, capacidade)
       SELECT * FROM unnest($1::text[], $2::integer[])
       RETURNING id, nome, capacidade`,
      [[`${PREFIXO_TESTE} ${execucao} A`, `${PREFIXO_TESTE} ${execucao} B`], [10, 4]],
    );
    salas.sort((a, b) => a.nome.localeCompare(b.nome));
    const ids = salas.map((sala) => sala.id);

    return {
      repositorio: modulo.criarRepositorioPostgres(pool),
      salas,
      limpar: () => apagarDadosDeTeste(pool, "id = ANY($1::uuid[])", [ids]),
    };
  });
});
