// Ficheiro de composição: o único sítio da apresentação que importa de src/persistencia/.
// Cria o repositório e entrega-o aos casos de uso. Só é usado no servidor (Server Components e Server Actions).
import { listarReservas } from "../aplicacional/listarReservas.js";
import { listarSalas } from "../aplicacional/listarSalas.js";
import { reservarSala } from "../aplicacional/reservarSala.js";
import { criarLigacao } from "../persistencia/ligacao.js";
import { criarRepositorioPostgres } from "../persistencia/repositorioPostgres.js";

// Repositório PostgreSQL (Aiven) com a ligação segura, a partir de DATABASE_URL e DATABASE_CA_CERT.
// Criado no primeiro uso e não ao importar, para o build não precisar das credenciais. Fica em globalThis para haver
// um só pool por processo, mesmo com o recarregamento de módulos do `next dev`. Os testes podem pôr aqui outro repositório.
function repositorio() {
  globalThis.repositorioReservas ??= criarRepositorioPostgres(criarLigacao());
  return globalThis.repositorioReservas;
}

export function reservarSalaNaApp(pedido) {
  return reservarSala({ repositorio: repositorio() }, pedido);
}

export function listarSalasNaApp() {
  return listarSalas({ repositorio: repositorio() });
}

export function listarReservasNaApp() {
  return listarReservas({ repositorio: repositorio() });
}
