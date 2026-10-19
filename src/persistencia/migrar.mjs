// "npm run migrar": aplica o esquema na base de dados do Aiven. Corre só com node (sem Next.js), na raiz do projeto.
// Usa o utilizador administrador (DATABASE_ADMIN_URL) e o certificado (DATABASE_CA_CERT), lidos do .env.local.
// Nunca escreve o endereço, o utilizador nem a palavra-passe.
import { carregarAmbiente, ErroAmbiente } from "./ambiente.js";
import { criarLigacao, ErroLigacao, verificarLigacao } from "./ligacao.js";
import { ErroMigracao, executarMigracao } from "./migracao.js";

async function main() {
  carregarAmbiente("npm run migrar");
  const pool = criarLigacao({ databaseUrl: process.env.DATABASE_ADMIN_URL, nomeVariavelEndereco: "DATABASE_ADMIN_URL" });
  try {
    console.log("A ligar à base de dados…");
    await verificarLigacao(pool);
    const { salasCriadas, avisos } = await executarMigracao(pool);
    const nota = salasCriadas === 0 ? " (já existiam)" : "";
    console.log(`✓ Migração concluída. Salas de exemplo criadas agora: ${salasCriadas}${nota}.`);
    if (avisos.length > 0) {
      console.log(`  Reveja ${avisos.length === 1 ? "o aviso" : `os ${avisos.length} avisos`} acima.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((erro) => {
  const conhecido = erro instanceof ErroLigacao || erro instanceof ErroMigracao || erro instanceof ErroAmbiente;
  // Um erro desconhecido pode trazer credenciais na mensagem: mostra-se só o tipo.
  console.error(`✗ ${conhecido ? erro.message : `Erro inesperado na migração (${erro?.name ?? "desconhecido"}).`}`);
  process.exitCode = 1;
});
