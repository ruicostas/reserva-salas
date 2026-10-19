// "npm run verificar-ligacao": confirma que a ligação da aplicação (DATABASE_URL) é segura e que o utilizador só tem as
// permissões previstas. Corre só com node (sem Next.js), na raiz do projeto, e lê o .env.local.
// Nada fica gravado: o teste de escrita corre numa transação que é sempre anulada. Nunca mostra o endereço nem a palavra-passe.
import { carregarAmbiente, ErroAmbiente } from "./ambiente.js";
import { criarLigacao, ErroLigacao, verificarLigacao } from "./ligacao.js";
import { ErroVerificacao, formatarRelatorio, verificarSeguranca } from "./verificacaoSeguranca.js";

async function main() {
  carregarAmbiente("npm run verificar-ligacao");
  const pool = criarLigacao();
  try {
    console.log("A ligar à base de dados…\n");
    await verificarLigacao(pool);
    const relatorio = await verificarSeguranca(pool);
    console.log(formatarRelatorio(relatorio));
    if (!relatorio.ok) {
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((erro) => {
  const conhecido = erro instanceof ErroLigacao || erro instanceof ErroVerificacao || erro instanceof ErroAmbiente;
  // Um erro desconhecido pode trazer credenciais na mensagem: mostra-se só o tipo.
  console.error(`✗ ${conhecido ? erro.message : `Erro inesperado na verificação (${erro?.name ?? "desconhecido"}).`}`);
  process.exitCode = 1;
});
