import { randomUUID } from "node:crypto";
import { criarSala } from "../dominio/sala.js";
import { testarContratoRepositorio } from "./contratoRepositorio.js";
import { criarRepositorioMemoria } from "./repositorioMemoria.js";

testarContratoRepositorio("em memória", async () => {
  const salas = [
    criarSala({ id: randomUUID(), nome: "Sala de teste A", capacidade: 10 }),
    criarSala({ id: randomUUID(), nome: "Sala de teste B", capacidade: 4 }),
  ];
  return { repositorio: criarRepositorioMemoria({ salas }), salas, limpar: async () => {} };
});
