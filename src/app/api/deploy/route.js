// Só existe em desenvolvimento: em produção devolve sempre 404.
import { connection } from "next/server";
import { MENSAGEM_ENV_EM_FALTA, commitEPush, criarExecutorGit, lerConfig, obterPendente, pedidoLocal } from "./git.js";

function naoEncontrado() {
  return new Response("Not Found", { status: 404 });
}

function erro(mensagem, status) {
  return Response.json({ erro: mensagem }, { status });
}

// Validações comuns a GET e POST. Devolve { resposta } em caso de erro, ou { config, git }.
async function preparar(request) {
  await connection();
  if (process.env.NODE_ENV !== "development") {
    return { resposta: naoEncontrado() };
  }
  if (!pedidoLocal(request.headers.get("host"), request.headers.get("origin"))) {
    return { resposta: erro("Pedido recusado: só é aceite a partir de localhost.", 403) };
  }
  const config = lerConfig(process.env);
  if (!config) {
    return { resposta: erro(MENSAGEM_ENV_EM_FALTA, 500) };
  }
  return { config, git: criarExecutorGit({ token: config.token }) };
}

export async function GET(request) {
  const { resposta, config, git } = await preparar(request);
  if (resposta) {
    return resposta;
  }
  try {
    return Response.json({ pendente: await obterPendente(config, git) });
  } catch (e) {
    return erro(e.message, 500);
  }
}

export async function POST(request) {
  const { resposta, config, git } = await preparar(request);
  if (resposta) {
    return resposta;
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return erro("Content-Type tem de ser application/json.", 415);
  }

  let mensagem;
  try {
    mensagem = String((await request.json()).mensagem ?? "").trim();
  } catch {
    return erro("Corpo do pedido inválido.", 400);
  }
  if (mensagem === "") {
    return erro("A mensagem do commit não pode estar vazia.", 400);
  }

  try {
    await commitEPush(config, mensagem, git);
    return Response.json({ ok: true });
  } catch (e) {
    return erro(e.message, 500);
  }
}
