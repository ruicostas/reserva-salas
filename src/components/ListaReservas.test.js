// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ListaReservas from "./ListaReservas";

afterEach(cleanup);

const RESERVA = {
  id: "0b0e0c7e-0000-4000-8000-000000000001",
  nomeSala: "Sala A",
  intervalo: "terça, 10/11/2026 · 10:00–11:00",
  inicioIso: "2026-11-10T10:00:00.000Z",
  numeroPessoas: 4,
};

describe("ListaReservas", () => {
  it("mostra a sala, o intervalo em hora de Lisboa, o número de pessoas e o botão Cancelar", () => {
    render(<ListaReservas reservas={[RESERVA]} />);

    expect(screen.getByText("Sala A")).toBeTruthy();
    expect(screen.getByText("terça, 10/11/2026 · 10:00–11:00").getAttribute("datetime")).toBe("2026-11-10T10:00:00.000Z");
    expect(screen.getByText("4 pessoas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
  });

  it("usa o singular para 1 pessoa", () => {
    render(<ListaReservas reservas={[{ ...RESERVA, numeroPessoas: 1 }]} />);

    expect(screen.getByText("1 pessoa")).toBeTruthy();
  });

  it("indica quando a sala da reserva já não existe", () => {
    render(<ListaReservas reservas={[{ ...RESERVA, nomeSala: null }]} />);

    expect(screen.getByText("Sala removida")).toBeTruthy();
  });

  it("mostra uma mensagem quando não há reservas", () => {
    render(<ListaReservas reservas={[]} />);

    expect(screen.getByText("Ainda não há reservas.")).toBeTruthy();
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
