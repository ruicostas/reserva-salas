// Só para testes: contrato que qualquer implementação de RepositorioReservas (src/aplicacional/repositorio.js) tem de cumprir.
// Cada implementação chama testarContratoRepositorio com uma função que cria um contexto novo para cada teste:
//   async () => ({ repositorio, salas: [salaA, salaB], limpar: async () => {} })
// As salas do contexto já existem no repositório e são só deste teste (numa base de dados real podem existir outras).
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarReserva } from "../dominio/reserva.js";

const UMA_HORA_MS = 60 * 60 * 1000;

function reservaNaSala(sala, inicio, { duracaoMs = UMA_HORA_MS, numeroPessoas = 2 } = {}) {
  const inicioDate = new Date(inicio);
  return criarReserva({
    id: randomUUID(),
    salaId: sala.id,
    inicio: inicioDate,
    fim: new Date(inicioDate.getTime() + duracaoMs),
    numeroPessoas,
  });
}

// Forma comparável de uma reserva: o instante em milissegundos não deixa esconder desvios de fuso horário.
function dados(reserva) {
  return {
    id: reserva.id,
    salaId: reserva.salaId,
    inicioMs: reserva.inicio.getTime(),
    fimMs: reserva.fim.getTime(),
    numeroPessoas: reserva.numeroPessoas,
  };
}

function idsDe(reservas) {
  return reservas.map((reserva) => reserva.id).sort();
}

// Instantes escolhidos para apanhar conversões erradas: milissegundos, mudanças de hora de Lisboa, outro fuso na escrita,
// passagem de ano e datas longínquas.
const INSTANTES = [
  ["com milissegundos", "2026-11-10T10:00:00.123Z"],
  ["na 1.ª ocorrência da hora repetida de outubro (01:30 de verão em Lisboa)", "2026-10-25T00:30:00.000Z"],
  ["na 2.ª ocorrência da hora repetida de outubro (01:30 de inverno em Lisboa)", "2026-10-25T01:30:00.000Z"],
  ["logo a seguir ao salto de março (02:00 em Lisboa)", "2026-03-29T01:00:00.000Z"],
  ["escrito com o fuso +01:00", "2026-07-15T10:00:00+01:00"],
  ["a atravessar a passagem de ano", "2026-12-31T23:30:00.000Z"],
  ["no ano 2999", "2999-12-31T22:00:00.000Z"],
];

export function testarContratoRepositorio(nome, criarContexto) {
  describe(`contrato do repositório — ${nome}`, () => {
    let contexto;

    beforeEach(async () => {
      contexto = await criarContexto();
    });

    afterEach(async () => {
      await contexto?.limpar();
    });

    describe("salas", () => {
      it("listarSalas inclui as salas existentes, com id, nome e capacidade", async () => {
        const salas = await contexto.repositorio.listarSalas();

        for (const esperada of contexto.salas) {
          const lida = salas.find((sala) => sala.id === esperada.id);
          expect(lida, `sala ${esperada.nome}`).toBeDefined();
          expect({ id: lida.id, nome: lida.nome, capacidade: lida.capacidade }).toEqual({
            id: esperada.id,
            nome: esperada.nome,
            capacidade: esperada.capacidade,
          });
        }
      });
    });

    describe("guardar e ler reservas", () => {
      it("guardarReserva devolve a reserva guardada, com os mesmos dados", async () => {
        const [salaA] = contexto.salas;
        const reserva = reservaNaSala(salaA, "2026-11-10T10:00:00Z", { numeroPessoas: 4 });

        const devolvida = await contexto.repositorio.guardarReserva(reserva);

        expect(dados(devolvida)).toEqual(dados(reserva));
      });

      it("uma reserva guardada volta a ser lida com os mesmos dados", async () => {
        const [salaA] = contexto.salas;
        const reserva = reservaNaSala(salaA, "2026-11-10T10:00:00Z", { duracaoMs: 90 * 60 * 1000, numeroPessoas: 5 });
        await contexto.repositorio.guardarReserva(reserva);

        const lida = (await contexto.repositorio.listarReservas()).find((candidata) => candidata.id === reserva.id);

        expect(lida, "reserva guardada").toBeDefined();
        expect(dados(lida)).toEqual(dados(reserva));
      });

      it("as reservas lidas têm datas como Date e o número de pessoas como número", async () => {
        const [salaA] = contexto.salas;
        await contexto.repositorio.guardarReserva(reservaNaSala(salaA, "2026-11-10T10:00:00Z"));

        const [lida] = await contexto.repositorio.listarReservasDaSala(salaA.id);

        expect(lida.inicio).toBeInstanceOf(Date);
        expect(lida.fim).toBeInstanceOf(Date);
        expect(typeof lida.numeroPessoas).toBe("number");
      });

      it("listarReservasDaSala devolve só as reservas dessa sala", async () => {
        const [salaA, salaB] = contexto.salas;
        const r1 = reservaNaSala(salaA, "2026-11-10T09:00:00Z");
        const r2 = reservaNaSala(salaB, "2026-11-10T09:00:00Z");
        const r3 = reservaNaSala(salaA, "2026-11-10T11:00:00Z");
        for (const reserva of [r1, r2, r3]) {
          await contexto.repositorio.guardarReserva(reserva);
        }

        expect(idsDe(await contexto.repositorio.listarReservasDaSala(salaA.id))).toEqual(idsDe([r1, r3]));
        expect(idsDe(await contexto.repositorio.listarReservasDaSala(salaB.id))).toEqual(idsDe([r2]));
      });

      it("listarReservasDaSala devolve uma lista vazia para uma sala sem reservas", async () => {
        const [salaA, salaB] = contexto.salas;
        await contexto.repositorio.guardarReserva(reservaNaSala(salaA, "2026-11-10T10:00:00Z"));

        expect(await contexto.repositorio.listarReservasDaSala(salaB.id)).toEqual([]);
      });

      it("listarReservas inclui as reservas de todas as salas", async () => {
        const [salaA, salaB] = contexto.salas;
        const r1 = reservaNaSala(salaA, "2026-11-10T10:00:00Z");
        const r2 = reservaNaSala(salaB, "2026-11-10T10:00:00Z");
        await contexto.repositorio.guardarReserva(r1);
        await contexto.repositorio.guardarReserva(r2);

        const ids = idsDe(await contexto.repositorio.listarReservas());

        expect(ids).toEqual(expect.arrayContaining([r1.id, r2.id]));
      });
    });

    describe("a hora lida é exatamente a guardada (sem desvios de fuso horário)", () => {
      it.each(INSTANTES)("início %s", async (_descricao, inicio) => {
        const [salaA] = contexto.salas;
        const reserva = reservaNaSala(salaA, inicio);
        await contexto.repositorio.guardarReserva(reserva);

        const [lida] = await contexto.repositorio.listarReservasDaSala(salaA.id);

        expect(lida.inicio.getTime()).toBe(reserva.inicio.getTime());
        expect(lida.fim.getTime()).toBe(reserva.fim.getTime());
        expect(lida.inicio.toISOString()).toBe(new Date(inicio).toISOString());
      });
    });
  });
}
