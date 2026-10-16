import { describe, expect, it } from "vitest";
import { criarSala } from "../dominio/sala.js";
import { listarSalas } from "./listarSalas.js";
import { criarRepositorioFalso } from "./repositorioFalso.js";

describe("listarSalas", () => {
  it("devolve as salas ordenadas por nome", async () => {
    const repositorio = criarRepositorioFalso({
      salas: [
        criarSala({ id: 3, nome: "Sala Tejo", capacidade: 20 }),
        criarSala({ id: 1, nome: "Sala Atlântico", capacidade: 12 }),
        criarSala({ id: 2, nome: "Sala Douro", capacidade: 6 }),
      ],
    });

    const salas = await listarSalas({ repositorio });

    expect(salas.map((sala) => sala.nome)).toEqual(["Sala Atlântico", "Sala Douro", "Sala Tejo"]);
  });

  it("devolve uma lista vazia quando não há salas", async () => {
    expect(await listarSalas({ repositorio: criarRepositorioFalso() })).toEqual([]);
  });
});
