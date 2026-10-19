// Contrato do repositório contra a base de dados PostgreSQL real (DATABASE_URL e DATABASE_CA_CERT do .env.local).
// Fica ignorado até existir src/persistencia/repositorioPostgres.js, que deve exportar criarRepositorioPostgres(pool).
// Dados de teste: cada teste cria salas próprias com o prefixo [teste-contrato] e apaga-as no fim, com as suas reservas.
// Antes e depois da suite apagam-se também restos de execuções interrompidas. As reservas reais nunca são tocadas.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe } from "vitest";
import { testarContratoRepositorio } from "./contratoRepositorio.js";
import { criarLigacao } from "./ligacao.js";

const PREFIXO_TESTE = "[teste-contrato]";

// Caminho numa variável: o Vite não tenta resolver o ficheiro enquanto ele não existir.
const CAMINHO_REPOSITORIO = "./repositorioPostgres.js";
const modulo = await import(/* @vite-ignore */ CAMINHO_REPOSITORIO).catch(() => null);

function motivoParaIgnorar() {
  if (!process.env.DATABASE_URL) {
    return "falta DATABASE_URL no .env.local";
  }
  if (typeof modulo?.criarRepositorioPostgres !== "function") {
    return "src/persistencia/repositorioPostgres.js ainda não existe";
  }
  return null;
}

const motivo = motivoParaIgnorar();

async function apagarDadosDeTeste(pool, condicao, parametros) {
  await pool.query(`DELETE FROM reservas WHERE sala_id IN (SELECT id FROM salas WHERE ${condicao})`, parametros);
  await pool.query(`DELETE FROM salas WHERE ${condicao}`, parametros);
}

describe.skipIf(motivo)(`PostgreSQL${motivo ? ` (ignorado: ${motivo})` : ""}`, () => {
  let pool;

  beforeAll(async () => {
    pool = criarLigacao();
    await apagarDadosDeTeste(pool, "starts_with(nome, $1)", [PREFIXO_TESTE]);
  });

  afterAll(async () => {
    if (pool) {
      await apagarDadosDeTeste(pool, "starts_with(nome, $1)", [PREFIXO_TESTE]);
      await pool.end();
    }
  });

  testarContratoRepositorio("PostgreSQL", async () => {
    const execucao = randomUUID();
    const { rows: salas } = await pool.query(
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
