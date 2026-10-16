// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import BotaoReservar from "./BotaoReservar";

// A Server Action é simulada: estes testes verificam só o ecrã, não a reserva.
const { reservarSalaAction } = vi.hoisted(() => ({ reservarSalaAction: vi.fn() }));
vi.mock("../app/actions", () => ({ reservarSalaAction }));

const MENSAGEM_DURACAO = "Uma reserva pode durar no máximo 2 horas.";

beforeAll(() => {
  // O jsdom não implementa showModal/close do <dialog>: versão mínima, com o evento "close" que o componente usa.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
});

beforeEach(() => {
  reservarSalaAction.mockReset();
});

afterEach(cleanup);

function abrirFormulario() {
  render(<BotaoReservar salaId={2} nomeSala="Sala Douro" capacidade={6} />);
  fireEvent.click(screen.getByRole("button", { name: "Reservar" }));
  return document.querySelector("dialog");
}

function preencherESubmeter({ data = "2026-11-10", horaInicio = "10:00", horaFim = "12:01", numeroPessoas = "4" } = {}) {
  fireEvent.change(screen.getByLabelText("Data da reserva"), { target: { value: data } });
  fireEvent.change(screen.getByLabelText("Hora de início"), { target: { value: horaInicio } });
  fireEvent.change(screen.getByLabelText("Hora de fim"), { target: { value: horaFim } });
  fireEvent.change(screen.getByLabelText(/Número de pessoas/), { target: { value: numeroPessoas } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
}

describe("BotaoReservar", () => {
  it("mostra a nota com o limite de 2 horas e a regra do dia seguinte", () => {
    abrirFormulario();

    expect(screen.getByText(/máximo 2 horas/)).toBeTruthy();
    expect(screen.getByText(/termina no dia seguinte/)).toBeTruthy();
  });

  it("mostra a capacidade máxima no campo do número de pessoas", () => {
    abrirFormulario();

    const campo = screen.getByLabelText("Número de pessoas (máx. 6)");
    expect(campo.getAttribute("max")).toBe("6");
  });

  it("envia os dados do formulário e a sala à Server Action", async () => {
    reservarSalaAction.mockResolvedValue({ sucesso: true });
    abrirFormulario();

    preencherESubmeter();

    await waitFor(() => expect(reservarSalaAction).toHaveBeenCalledTimes(1));
    const dados = reservarSalaAction.mock.calls[0][1];
    expect(Object.fromEntries(dados)).toEqual({
      salaId: "2",
      data: "2026-11-10",
      horaInicio: "10:00",
      horaFim: "12:01",
      numeroPessoas: "4",
    });
  });

  it("mostra a caixa de erro e mantém o formulário aberto e preenchido quando a reserva é recusada", async () => {
    reservarSalaAction.mockResolvedValue({ sucesso: false, mensagem: MENSAGEM_DURACAO });
    const dialogo = abrirFormulario();

    preencherESubmeter();

    expect((await screen.findByRole("alert")).textContent).toBe(MENSAGEM_DURACAO);
    expect(dialogo.open).toBe(true);
    expect(screen.getByLabelText("Hora de fim").value).toBe("12:01");
  });

  it("deixa de mostrar o erro depois de Cancelar e voltar a abrir", async () => {
    reservarSalaAction.mockResolvedValue({ sucesso: false, mensagem: MENSAGEM_DURACAO });
    abrirFormulario();
    preencherESubmeter();
    await screen.findByRole("alert");

    act(() => fireEvent.click(screen.getByRole("button", { name: "Cancelar" })));
    fireEvent.click(screen.getByRole("button", { name: "Reservar" }));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("fecha o formulário e limpa os campos quando a reserva é aceite", async () => {
    reservarSalaAction.mockResolvedValue({ sucesso: true });
    const dialogo = abrirFormulario();

    preencherESubmeter({ horaFim: "12:00" });

    await waitFor(() => expect(dialogo.open).toBe(false));
    expect(screen.getByLabelText("Hora de fim").value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
