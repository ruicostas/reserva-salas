import { describe, expect, it, vi } from "vitest";
import {
  calcularPendente,
  commitEPush,
  criarExecutorGit,
  envGit,
  lerConfig,
  obterPendente,
  ocultarSegredos,
  pedidoLocal,
  tokenBase64,
} from "./git.js";

const ENV_COMPLETO = {
  GIT_TOKEN: "ghp_segredo123",
  GIT_REPO_URL: "github.com/utilizador/reserva-salas.git",
  GIT_USER_NAME: "Rui",
  GIT_USER_EMAIL: "rui@exemplo.pt",
};

const CONFIG = lerConfig(ENV_COMPLETO);

describe("lerConfig", () => {
  it("devolve a configuração quando todas as variáveis existem", () => {
    expect(CONFIG).toEqual({
      token: "ghp_segredo123",
      urlRepo: "https://github.com/utilizador/reserva-salas.git",
      nomeUtilizador: "Rui",
      emailUtilizador: "rui@exemplo.pt",
    });
  });

  it.each(Object.keys(ENV_COMPLETO))("devolve null quando falta %s", (nome) => {
    expect(lerConfig({ ...ENV_COMPLETO, [nome]: undefined })).toBeNull();
    expect(lerConfig({ ...ENV_COMPLETO, [nome]: "   " })).toBeNull();
  });

  it("não duplica o prefixo https://", () => {
    expect(lerConfig({ ...ENV_COMPLETO, GIT_REPO_URL: "https://github.com/u/r.git" }).urlRepo).toBe("https://github.com/u/r.git");
  });
});

describe("tokenBase64", () => {
  it("codifica x-access-token:<token>", () => {
    expect(Buffer.from(tokenBase64("abc"), "base64").toString()).toBe("x-access-token:abc");
  });
});

describe("envGit", () => {
  it("passa o cabeçalho por GIT_CONFIG_* e retira as variáveis GIT_ do processo filho", () => {
    const env = envGit({ PATH: "/bin", ...ENV_COMPLETO }, "ghp_segredo123");
    expect(env.PATH).toBe("/bin");
    expect(env.GIT_CONFIG_KEY_0).toBe("http.extraHeader");
    expect(env.GIT_CONFIG_VALUE_0).toBe(`Authorization: Basic ${tokenBase64("ghp_segredo123")}`);
    expect(env.GIT_TOKEN).toBeUndefined();
    expect(env.GIT_REPO_URL).toBeUndefined();
  });
});

describe("ocultarSegredos", () => {
  it("substitui o token e o base64 por ***", () => {
    const texto = `falhou ghp_segredo123 Basic ${tokenBase64("ghp_segredo123")}`;
    const resultado = ocultarSegredos(texto, "ghp_segredo123");
    expect(resultado).not.toContain("ghp_segredo123");
    expect(resultado).not.toContain(tokenBase64("ghp_segredo123"));
    expect(resultado).toBe("falhou *** Basic ***");
  });
});

describe("pedidoLocal", () => {
  it("aceita localhost sem Origin ou com Origin igual", () => {
    expect(pedidoLocal("localhost:3000", null)).toBe(true);
    expect(pedidoLocal("127.0.0.1:3000", "http://127.0.0.1:3000")).toBe(true);
  });

  it("rejeita outros sites, a rede local e pedidos sem Host", () => {
    expect(pedidoLocal("localhost:3000", "https://site-malicioso.com")).toBe(false);
    expect(pedidoLocal("192.168.1.20:3000", null)).toBe(false);
    expect(pedidoLocal("site-malicioso.com", null)).toBe(false);
    expect(pedidoLocal(null, null)).toBe(false);
  });
});

describe("calcularPendente", () => {
  it("é pendente quando há alterações por commit", () => {
    expect(calcularPendente({ porcelain: " M a.js\n", head: "abc\n", lsRemote: "abc\trefs/heads/main\n" })).toBe(true);
  });

  it("é pendente quando HEAD difere do remoto ou o remoto não tem main", () => {
    expect(calcularPendente({ porcelain: "", head: "abc\n", lsRemote: "def\trefs/heads/main\n" })).toBe(true);
    expect(calcularPendente({ porcelain: "", head: "abc\n", lsRemote: "" })).toBe(true);
  });

  it("não é pendente quando está tudo enviado", () => {
    expect(calcularPendente({ porcelain: "", head: "abc\n", lsRemote: "abc\trefs/heads/main\n" })).toBe(false);
  });
});

describe("obterPendente", () => {
  it("consulta status, HEAD e o remoto", async () => {
    const git = vi.fn(async (args) => ({ status: "", "rev-parse": "abc\n", "ls-remote": "abc\trefs/heads/main\n" })[args[0]]);
    expect(await obterPendente(CONFIG, git)).toBe(false);
    expect(git).toHaveBeenCalledWith(["ls-remote", CONFIG.urlRepo, "main"]);
  });
});

describe("commitEPush", () => {
  it("faz add, commit com a mensagem como argumento separado, e push", async () => {
    const git = vi.fn(async (args) => (args[0] === "status" ? " M a.js\n" : ""));
    const mensagem = 'WIP "aspas"; rm -rf /';
    await commitEPush(CONFIG, mensagem, git);
    expect(git.mock.calls.map(([args]) => args)).toEqual([
      ["add", "-A"],
      ["status", "--porcelain"],
      ["-c", "user.name=Rui", "-c", "user.email=rui@exemplo.pt", "commit", "-m", mensagem],
      ["push", CONFIG.urlRepo, "main"],
    ]);
  });

  it("salta o commit quando não há alterações, mas faz push", async () => {
    const git = vi.fn(async () => "");
    await commitEPush(CONFIG, "msg", git);
    expect(git.mock.calls.map(([args]) => args[0])).toEqual(["add", "status", "push"]);
  });

  it("propaga o erro do push", async () => {
    const git = vi.fn(async (args) => {
      if (args[0] === "push") {
        throw new Error("rejected");
      }
      return "";
    });
    await expect(commitEPush(CONFIG, "msg", git)).rejects.toThrow("rejected");
  });
});

describe("criarExecutorGit", () => {
  it("corre git a sério e devolve erros sem o token", async () => {
    const git = criarExecutorGit({ token: "ghp_segredo123" });
    expect(await git(["--version"])).toMatch(/^git version/);
    await expect(git(["comando-inexistente-ghp_segredo123"])).rejects.toThrow(/\*\*\*/);
    await expect(git(["comando-inexistente-ghp_segredo123"])).rejects.not.toThrow(/ghp_segredo123/);
  });
});
