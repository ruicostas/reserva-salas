// Repositório PostgreSQL que cumpre a interface RepositorioReservas (ver src/aplicacional/repositorio.js).
// Recebe um pool criado com criarLigacao (ligação cifrada e verificada). As consultas são texto fixo com parâmetros
// ($1, $2, ...): os valores nunca são colados no SQL.
import { ErroDominio } from "../dominio/erros.js";
import { criarReserva } from "../dominio/reserva.js";
import { criarSala } from "../dominio/sala.js";
import { CODIGOS_SOBREPOSICAO } from "../dominio/sobreposicao.js";
import { mensagemSegura } from "./ligacao.js";

const COLUNAS_RESERVA = "id, sala_id, inicio, fim, numero_pessoas";

const SQL = Object.freeze({
  listarSalas: "SELECT id, nome, capacidade FROM salas ORDER BY nome",
  listarReservas: `SELECT ${COLUNAS_RESERVA} FROM reservas ORDER BY inicio`,
  listarReservasDaSala: `SELECT ${COLUNAS_RESERVA} FROM reservas WHERE sala_id = $1 ORDER BY inicio`,
  guardarReserva: `INSERT INTO reservas (${COLUNAS_RESERVA}) VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUNAS_RESERVA}`,
});

// Código do PostgreSQL quando a restrição reservas_sem_sobreposicao recusa uma reserva (ex.: dois pedidos em simultâneo).
const VIOLACAO_DE_EXCLUSAO = "23P01";

export class ErroRepositorio extends Error {
  constructor(mensagem, codigoPostgres) {
    super(mensagem);
    this.name = "ErroRepositorio";
    if (codigoPostgres) {
      this.codigoPostgres = codigoPostgres;
    }
  }
}

function paraReserva(linha) {
  return criarReserva({
    id: linha.id,
    salaId: linha.sala_id,
    inicio: linha.inicio,
    fim: linha.fim,
    numeroPessoas: linha.numero_pessoas,
  });
}

/**
 * @param {import("pg").Pool} pool Pool criado com criarLigacao.
 * @returns {import("../aplicacional/repositorio.js").RepositorioReservas}
 */
export function criarRepositorioPostgres(pool) {
  // Um erro da base de dados nunca sai tal como vem: pode trazer o servidor ou o utilizador na mensagem.
  async function consultar(operacao, sql, parametros) {
    try {
      return await pool.query(sql, parametros);
    } catch (erro) {
      if (erro?.code === VIOLACAO_DE_EXCLUSAO) {
        throw new ErroDominio(CODIGOS_SOBREPOSICAO.SALA_OCUPADA, "recusada pela base de dados (reservas_sem_sobreposicao)");
      }
      throw new ErroRepositorio(`Falhou ${operacao} na base de dados (${mensagemSegura(pool, erro)})`, erro?.code);
    }
  }

  return {
    async listarSalas() {
      const { rows } = await consultar("a leitura das salas", SQL.listarSalas);
      return rows.map((linha) => criarSala({ id: linha.id, nome: linha.nome, capacidade: linha.capacidade }));
    },

    async listarReservas() {
      const { rows } = await consultar("a leitura das reservas", SQL.listarReservas);
      return rows.map(paraReserva);
    },

    async listarReservasDaSala(salaId) {
      const { rows } = await consultar("a leitura das reservas da sala", SQL.listarReservasDaSala, [salaId]);
      return rows.map(paraReserva);
    },

    async guardarReserva(reserva) {
      const parametros = [reserva.id, reserva.salaId, reserva.inicio, reserva.fim, reserva.numeroPessoas];
      const { rows } = await consultar("a gravação da reserva", SQL.guardarReserva, parametros);
      return paraReserva(rows[0]);
    },
  };
}
