// Carregamento do .env.local para os scripts que correm só com node (sem Next.js), a partir da raiz do projeto.
const FICHEIRO_AMBIENTE = ".env.local";

export class ErroAmbiente extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroAmbiente";
  }
}

export function carregarAmbiente(comando) {
  try {
    process.loadEnvFile(FICHEIRO_AMBIENTE);
  } catch (erro) {
    if (erro?.code === "ENOENT") {
      throw new ErroAmbiente(`Não encontrei o ficheiro ${FICHEIRO_AMBIENTE} em ${process.cwd()}. Corra "${comando}" na raiz do projeto.`);
    }
    // Só o código: a mensagem de um erro de leitura pode citar o conteúdo do ficheiro.
    throw new ErroAmbiente(`Não foi possível ler ${FICHEIRO_AMBIENTE} (${erro?.code ?? "erro desconhecido"}).`);
  }
}
