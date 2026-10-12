// Ferramenta de desenvolvimento: fora das 4 camadas da app (ver CLAUDE.md).
import { execFile } from "node:child_process";

export const MENSAGEM_ENV_EM_FALTA = "Variáveis GIT_ do .env.local não configuradas";

const VARIAVEIS_GIT = ["GIT_TOKEN", "GIT_REPO_URL", "GIT_USER_NAME", "GIT_USER_EMAIL"];
const RAMO = "main";
const HOSTS_LOCAIS = ["localhost", "127.0.0.1", "[::1]"];
const TIMEOUT_GIT_MS = 60_000;

// Devolve a configuração, ou null se faltar alguma variável.
export function lerConfig(env) {
  if (VARIAVEIS_GIT.some((nome) => !env[nome]?.trim())) {
    return null;
  }
  return {
    token: env.GIT_TOKEN.trim(),
    urlRepo: `https://${env.GIT_REPO_URL.trim().replace(/^https?:\/\//, "")}`,
    nomeUtilizador: env.GIT_USER_NAME.trim(),
    emailUtilizador: env.GIT_USER_EMAIL.trim(),
  };
}

export function tokenBase64(token) {
  return Buffer.from(`x-access-token:${token}`).toString("base64");
}

// O cabeçalho de autenticação vai por variáveis GIT_CONFIG_* (equivalente a `-c`),
// para o token não aparecer na linha de comando do processo git.
// credential.helper vazio impede o Git Credential Manager de abrir janelas.
export function envGit(envBase, token) {
  const env = { ...envBase };
  for (const nome of VARIAVEIS_GIT) {
    delete env[nome];
  }
  return {
    ...env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "2",
    GIT_CONFIG_KEY_0: "http.extraHeader",
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${tokenBase64(token)}`,
    GIT_CONFIG_KEY_1: "credential.helper",
    GIT_CONFIG_VALUE_1: "",
  };
}

export function ocultarSegredos(texto, token) {
  let resultado = String(texto ?? "");
  for (const segredo of [token, tokenBase64(token)]) {
    if (segredo) {
      resultado = resultado.split(segredo).join("***");
    }
  }
  return resultado;
}

// Só aceita pedidos feitos a partir da própria máquina e da própria origem (evita CSRF e acessos pela rede local).
export function pedidoLocal(host, origin) {
  if (!host) {
    return false;
  }
  const nomeHost = host.replace(/:\d+$/, "");
  if (!HOSTS_LOCAIS.includes(nomeHost)) {
    return false;
  }
  if (origin == null) {
    return true;
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function calcularPendente({ porcelain, head, lsRemote }) {
  if (porcelain.trim() !== "") {
    return true;
  }
  const shaRemoto = lsRemote.trim().split(/\s+/)[0] ?? "";
  return head.trim() !== shaRemoto;
}

// Corre o git com argumentos separados (sem shell). Erros saem sem o token.
export function criarExecutorGit({ token, cwd = process.cwd(), env = process.env }) {
  const envProcesso = envGit(env, token);
  return (args) =>
    new Promise((resolve, reject) => {
      execFile("git", args, { cwd, env: envProcesso, timeout: TIMEOUT_GIT_MS, windowsHide: true }, (erro, stdout, stderr) => {
        if (erro) {
          const detalhe = stderr?.trim() || stdout?.trim() || erro.message;
          reject(new Error(ocultarSegredos(detalhe, token)));
          return;
        }
        resolve(stdout);
      });
    });
}

export async function obterPendente(config, git) {
  const [porcelain, head, lsRemote] = await Promise.all([
    git(["status", "--porcelain"]),
    git(["rev-parse", "HEAD"]),
    git(["ls-remote", config.urlRepo, RAMO]),
  ]);
  return calcularPendente({ porcelain, head, lsRemote });
}

// Se não houver alterações para commit (só commits por enviar), faz apenas o push.
export async function commitEPush(config, mensagem, git) {
  await git(["add", "-A"]);
  const porcelain = await git(["status", "--porcelain"]);
  if (porcelain.trim() !== "") {
    await git([
      "-c",
      `user.name=${config.nomeUtilizador}`,
      "-c",
      `user.email=${config.emailUtilizador}`,
      "commit",
      "-m",
      mensagem,
    ]);
  }
  await git(["push", config.urlRepo, RAMO]);
}
