import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarSala } from "../dominio/sala.js";
import { criarRepositorioMemoria } from "../persistencia/repositorioMemoria.js";
import { mensagemDeErro } from "./mensagensErro.js";

// refresh() só funciona dentro de um pedido real do Next; nos testes é simulado e espiado.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => ({ refresh }));

function formulario({ salaId = "1", data = "2026-11-10", horaInicio = "10:00", horaFim = "11:00", numeroPessoas = "2" } = {}) {
  const dados = new FormData();
  dados.set("salaId", salaId);
  dados.set("data", data);
  dados.set("horaInicio", horaInicio);
  dados.set("horaFim", horaFim);
  dados.set("numeroPessoas", numeroPessoas);
  return dados;
}

// Estes testes são da Server Action: usam um repositório em memória injetado na composição, nunca a base de dados real.
// Os ids das salas são texto, como os UUID do PostgreSQL; a Mondego tem mesmo um UUID.
const UUID_MONDEGO = "8d3f2c1a-5b6e-4f70-9a81-b2c3d4e5f607";
const SALAS_TESTE = [
  criarSala({ id: "1", nome: "Sala Atlântico", capacidade: 12 }),
  criarSala({ id: "2", nome: "Sala Douro", capacidade: 6 }),
  criarSala({ id: "3", nome: "Sala Tejo", capacidade: 20 }),
  criarSala({ id: UUID_MONDEGO, nome: "Sala Mondego", capacidade: 4 }),
];

// Cada teste começa com um repositório em memória novo.
let reservarSalaAction;
beforeEach(async () => {
  globalThis.repositorioReservas = criarRepositorioMemoria({ salas: SALAS_TESTE });
  refresh.mockClear();
  vi.resetModules();
  ({ reservarSalaAction } = await import("./actions.js"));
});

describe("reservarSalaAction", () => {
  it("reserva uma sala livre", async () => {
    expect(await reservarSalaAction(null, formulario())).toEqual({ sucesso: true });
  });

  it("mostra a mensagem de sala ocupada quando o horário se sobrepõe", async () => {
    await reservarSalaAction(null, formulario({ horaInicio: "10:00", horaFim: "11:00" }));

    const resultado = await reservarSalaAction(null, formulario({ horaInicio: "10:30", horaFim: "11:30" }));

    expect(resultado).toEqual({ sucesso: false, mensagem: mensagemDeErro("SALA_OCUPADA") });
  });

  it("aceita uma reserva seguida e outra sala no mesmo horário", async () => {
    await reservarSalaAction(null, formulario({ horaInicio: "10:00", horaFim: "11:00" }));

    expect(await reservarSalaAction(null, formulario({ horaInicio: "11:00", horaFim: "12:00" }))).toEqual({ sucesso: true });
    expect(await reservarSalaAction(null, formulario({ salaId: "2", horaInicio: "10:00", horaFim: "11:00" }))).toEqual({ sucesso: true });
  });

  it("converte a hora de Lisboa para UTC antes de verificar sobreposições (hora de verão)", async () => {
    // 20/10/2026 é hora de verão (UTC+1): 10:00–11:00 em Lisboa = 09:00–10:00 UTC.
    await reservarSalaAction(null, formulario({ data: "2026-10-20", horaInicio: "10:00", horaFim: "11:00" }));

    // 09:00–10:00 em Lisboa = 08:00–09:00 UTC: seguida, não choca.
    expect(await reservarSalaAction(null, formulario({ data: "2026-10-20", horaInicio: "09:00", horaFim: "10:00" }))).toEqual({
      sucesso: true,
    });
    // 10:59–12:00 em Lisboa sobrepõe-se.
    expect((await reservarSalaAction(null, formulario({ data: "2026-10-20", horaInicio: "10:59", horaFim: "12:00" }))).sucesso).toBe(
      false,
    );
  });

  it("usa o id da sala tal como vem do formulário (UUID da base de dados, em texto)", async () => {
    expect(await reservarSalaAction(null, formulario({ salaId: UUID_MONDEGO }))).toEqual({ sucesso: true });
  });

  it("indica sala inexistente", async () => {
    expect(await reservarSalaAction(null, formulario({ salaId: "99" }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("SALA_INEXISTENTE"),
    });
  });

  it("indica campos em falta (a validação do browser pode ser contornada)", async () => {
    expect(await reservarSalaAction(null, formulario({ horaFim: "" }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("CAMPOS_EM_FALTA"),
    });
  });

  // Hora de fim igual à de início: fim não é posterior. (Com fim menor, a reserva passa a terminar no dia seguinte.)
  it("indica fim antes do início", async () => {
    expect(await reservarSalaAction(null, formulario({ horaInicio: "10:00", horaFim: "10:00" }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("RESERVA_FIM_NAO_POSTERIOR_AO_INICIO"),
    });
  });

  it("indica hora inexistente no salto para a hora de verão", async () => {
    expect(await reservarSalaAction(null, formulario({ data: "2026-03-29", horaInicio: "01:30", horaFim: "03:00" }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("HORA_INEXISTENTE"),
    });
  });

  it("indica data inválida para texto mal formado", async () => {
    expect(await reservarSalaAction(null, formulario({ data: "2026-02-30" }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("RESERVA_DATA_INVALIDA"),
    });
  });
});

describe("mensagemDeErro", () => {
  it("usa a mensagem genérica para códigos desconhecidos", () => {
    expect(mensagemDeErro("CODIGO_QUE_NAO_EXISTE")).toBe(mensagemDeErro("ERRO_INESPERADO"));
  });
});

describe("reservarSalaAction — número de pessoas", () => {
  it("indica capacidade excedida (Sala Douro tem 6 lugares)", async () => {
    expect(await reservarSalaAction(null, formulario({ salaId: "2", numeroPessoas: "7" }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("CAPACIDADE_EXCEDIDA"),
    });
  });

  it("aceita o número de pessoas igual à capacidade", async () => {
    expect(await reservarSalaAction(null, formulario({ salaId: "2", numeroPessoas: "6" }))).toEqual({ sucesso: true });
  });

  it("indica campos em falta quando o número de pessoas não é preenchido", async () => {
    expect(await reservarSalaAction(null, formulario({ numeroPessoas: "" }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("CAMPOS_EM_FALTA"),
    });
  });

  it("indica número de pessoas inválido para valores não inteiros", async () => {
    expect(await reservarSalaAction(null, formulario({ numeroPessoas: "2.5" }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("RESERVA_NUMERO_PESSOAS_INVALIDO"),
    });
  });
});

describe("mensagemDeErro — número de pessoas", () => {
  it("tem mensagens próprias para os novos códigos", () => {
    expect(mensagemDeErro("CAPACIDADE_EXCEDIDA")).not.toBe(mensagemDeErro("ERRO_INESPERADO"));
    expect(mensagemDeErro("RESERVA_NUMERO_PESSOAS_INVALIDO")).not.toBe(mensagemDeErro("ERRO_INESPERADO"));
  });
});

describe("reservarSalaAction — atualização da página", () => {
  it("pede ao Next para atualizar a página quando a reserva é guardada", async () => {
    await reservarSalaAction(null, formulario());
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("não atualiza a página quando a reserva é rejeitada", async () => {
    await reservarSalaAction(null, formulario({ salaId: "99" }));
    await reservarSalaAction(null, formulario({ horaFim: "" }));
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("listarReservasNaApp", () => {
  it("devolve as reservas feitas pela Server Action, com o nome da sala", async () => {
    await reservarSalaAction(null, formulario({ salaId: "2", data: "2026-11-10", horaInicio: "10:00", horaFim: "11:00", numeroPessoas: "4" }));
    const { listarReservasNaApp } = await import("./composicao.js");

    const reservas = await listarReservasNaApp();

    expect(reservas).toHaveLength(1);
    expect(reservas[0]).toMatchObject({ salaId: "2", nomeSala: "Sala Douro", numeroPessoas: 4 });
    expect(reservas[0].inicio.toISOString()).toBe("2026-11-10T10:00:00.000Z");
  });
});

describe("reservarSalaAction — duração máxima", () => {
  it("indica que a reserva excede 2 horas", async () => {
    expect(await reservarSalaAction(null, formulario({ horaInicio: "10:00", horaFim: "12:01" }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("RESERVA_DURACAO_MAXIMA_EXCEDIDA"),
    });
  });

  it("tem uma mensagem própria para a duração excedida", () => {
    expect(mensagemDeErro("RESERVA_DURACAO_MAXIMA_EXCEDIDA")).not.toBe(mensagemDeErro("ERRO_INESPERADO"));
  });
});

describe("reservarSalaAction — casos limite da duração", () => {
  const DURACAO_EXCEDIDA = { sucesso: false, mensagem: mensagemDeErro("RESERVA_DURACAO_MAXIMA_EXCEDIDA") };

  it("aceita exatamente 2 horas em hora de Lisboa", async () => {
    expect(await reservarSalaAction(null, formulario({ data: "2026-10-20", horaInicio: "10:00", horaFim: "12:00" }))).toEqual({
      sucesso: true,
    });
  });

  it("conta tempo real no dia em que a hora atrasa: 00:30–02:00 de 25/10/2026 são 2h30 reais e é recusada", async () => {
    expect(await reservarSalaAction(null, formulario({ data: "2026-10-25", horaInicio: "00:30", horaFim: "02:00" }))).toEqual(
      DURACAO_EXCEDIDA,
    );
  });

  it("conta tempo real no dia em que a hora adianta: 00:30–03:00 de 29/03/2026 são 1h30 reais e é aceite", async () => {
    expect(await reservarSalaAction(null, formulario({ data: "2026-03-29", horaInicio: "00:30", horaFim: "03:00" }))).toEqual({
      sucesso: true,
    });
  });

  it("aceita uma reserva que atravessa a meia-noite: 23:00–01:00 termina no dia seguinte", async () => {
    expect(await reservarSalaAction(null, formulario({ data: "2026-11-10", horaInicio: "23:00", horaFim: "01:00" }))).toEqual({
      sucesso: true,
    });

    const { listarReservasNaApp } = await import("./composicao.js");
    const [reserva] = await listarReservasNaApp();
    expect(reserva.inicio.toISOString()).toBe("2026-11-10T23:00:00.000Z");
    expect(reserva.fim.toISOString()).toBe("2026-11-11T01:00:00.000Z");
  });

  it("atravessa também a mudança de mês e de ano", async () => {
    expect(await reservarSalaAction(null, formulario({ data: "2026-12-31", horaInicio: "23:30", horaFim: "00:30" }))).toEqual({
      sucesso: true,
    });
  });

  it("recusa uma reserva que atravessa a meia-noite com mais de 2 horas (22:00–01:00)", async () => {
    expect(await reservarSalaAction(null, formulario({ data: "2026-11-10", horaInicio: "22:00", horaFim: "01:00" }))).toEqual(
      DURACAO_EXCEDIDA,
    );
  });

  it("interpreta uma hora de fim menor como dia seguinte, mesmo que resulte em mais de 2 horas (11:00–10:00)", async () => {
    expect(await reservarSalaAction(null, formulario({ horaInicio: "11:00", horaFim: "10:00" }))).toEqual(DURACAO_EXCEDIDA);
  });

  it.each([
    ["10:00:30", "11:00"],
    ["10:00", "11:00:00"],
  ])("recusa horas com segundos (%s–%s) como data inválida", async (horaInicio, horaFim) => {
    expect(await reservarSalaAction(null, formulario({ horaInicio, horaFim }))).toEqual({
      sucesso: false,
      mensagem: mensagemDeErro("RESERVA_DATA_INVALIDA"),
    });
  });
});
