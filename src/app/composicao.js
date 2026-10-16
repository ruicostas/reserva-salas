// Ficheiro de composição: o único sítio da apresentação que importa de src/persistencia/.
// Cria o repositório e entrega-o aos casos de uso. Só é usado no servidor (Server Components e Server Actions).
import { listarReservas } from "../aplicacional/listarReservas.js";
import { reservarSala } from "../aplicacional/reservarSala.js";
import { criarRepositorioMemoria } from "../persistencia/repositorioMemoria.js";
import { SALAS_EXEMPLO } from "./dadosExemplo.js";

// Guardado em globalThis para sobreviver ao recarregamento de módulos do `next dev`.
// Os dados vivem só na memória deste processo: perdem-se ao reiniciar e não são partilhados entre instâncias.
function repositorio() {
  globalThis.repositorioReservasMemoria ??= criarRepositorioMemoria({ salas: SALAS_EXEMPLO });
  return globalThis.repositorioReservasMemoria;
}

export function reservarSalaNaApp(pedido) {
  return reservarSala({ repositorio: repositorio() }, pedido);
}

export function listarReservasNaApp() {
  return listarReservas({ repositorio: repositorio() });
}
