import { describe, expect, it } from "vitest";
import { diaSeguinte, formatarIntervaloLisboa, lisboaParaUtc } from "./fusoLisboa.js";

function utc(data, hora) {
  return lisboaParaUtc(data, hora)?.toISOString() ?? null;
}

describe("lisboaParaUtc", () => {
  it("no inverno, Lisboa coincide com UTC", () => {
    expect(utc("2026-01-15", "10:00")).toBe("2026-01-15T10:00:00.000Z");
  });

  it("no verão, Lisboa está uma hora à frente de UTC", () => {
    expect(utc("2026-07-15", "10:00")).toBe("2026-07-15T09:00:00.000Z");
  });

  it("ainda é hora de verão antes da mudança de outubro (25/10/2026)", () => {
    expect(utc("2026-10-20", "10:00")).toBe("2026-10-20T09:00:00.000Z");
  });

  it("já é hora de inverno depois da mudança de outubro", () => {
    expect(utc("2026-10-26", "10:00")).toBe("2026-10-26T10:00:00.000Z");
  });

  it("muda corretamente de dia quando a hora de Lisboa é logo depois da meia-noite no verão", () => {
    expect(utc("2026-07-15", "00:30")).toBe("2026-07-14T23:30:00.000Z");
  });

  it("devolve null para uma hora que não existe (salto de 29/03/2026, 01:00 → 02:00)", () => {
    expect(utc("2026-03-29", "01:30")).toBeNull();
  });

  it("aceita a primeira hora depois do salto de março", () => {
    expect(utc("2026-03-29", "02:00")).toBe("2026-03-29T01:00:00.000Z");
  });

  it("escolhe a primeira ocorrência de uma hora repetida (25/10/2026, 01:30)", () => {
    expect(utc("2026-10-25", "01:30")).toBe("2026-10-25T00:30:00.000Z");
  });

  it.each([
    [undefined, "10:00"],
    ["", "10:00"],
    ["2026-10-20", ""],
    ["20/10/2026", "10:00"],
    ["2026-10-20", "10h00"],
    ["2026-02-30", "10:00"],
    ["2026-10-20", "25:00"],
  ])("devolve null para o texto inválido %o / %o", (data, hora) => {
    expect(lisboaParaUtc(data, hora)).toBeNull();
  });
});

describe("formatarIntervaloLisboa", () => {
  it("mostra o dia e as horas de Lisboa no inverno", () => {
    expect(formatarIntervaloLisboa(new Date("2026-11-10T10:00:00Z"), new Date("2026-11-10T11:00:00Z"))).toBe(
      "terça, 10/11/2026 · 10:00–11:00",
    );
  });

  it("converte de UTC para a hora de verão de Lisboa", () => {
    expect(formatarIntervaloLisboa(new Date("2026-10-20T09:00:00Z"), new Date("2026-10-20T10:30:00Z"))).toBe(
      "terça, 20/10/2026 · 10:00–11:30",
    );
  });

  it("usa o dia de Lisboa quando em UTC ainda é o dia anterior", () => {
    expect(formatarIntervaloLisboa(new Date("2026-07-15T23:30:00Z"), new Date("2026-07-16T00:30:00Z"))).toBe(
      "quinta, 16/07/2026 · 00:30–01:30",
    );
  });

  it("mostra os dois dias quando a reserva atravessa a meia-noite", () => {
    expect(formatarIntervaloLisboa(new Date("2026-11-10T23:00:00Z"), new Date("2026-11-11T01:00:00Z"))).toBe(
      "terça, 10/11/2026 23:00 – quarta, 11/11/2026 01:00",
    );
  });

  it("é o inverso de lisboaParaUtc", () => {
    const inicio = lisboaParaUtc("2026-10-20", "14:15");
    const fim = lisboaParaUtc("2026-10-20", "15:45");
    expect(formatarIntervaloLisboa(inicio, fim)).toBe("terça, 20/10/2026 · 14:15–15:45");
  });
});

describe("diaSeguinte", () => {
  it.each([
    ["2026-11-10", "2026-11-11"],
    ["2026-11-30", "2026-12-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29"],
    ["2026-02-28", "2026-03-01"],
    ["2026-03-28", "2026-03-29"],
  ])("o dia seguinte a %s é %s", (data, esperado) => {
    expect(diaSeguinte(data)).toBe(esperado);
  });

  it.each([undefined, "", "10/11/2026", "2026-02-30"])("devolve null para a data inválida %o", (data) => {
    expect(diaSeguinte(data)).toBeNull();
  });
});
