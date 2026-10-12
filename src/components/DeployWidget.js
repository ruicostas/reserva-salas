"use client";

// Widget de desenvolvimento: só é renderizado pelo layout quando NODE_ENV === "development".
import { useCallback, useEffect, useRef, useState } from "react";

const CHAVE_POSICAO = "deploy-widget-posicao";
const TAMANHO = 96;
const MARGEM = 24;
const LIMIAR_ARRASTO = 5;
const INTERVALO_ESTADO_MS = 15_000;
const LARGURA_PAINEL = 288;
const ALTURA_PAINEL = 220;

function limitarAoEcra({ x, y }) {
  return {
    x: Math.min(Math.max(0, x), window.innerWidth - TAMANHO),
    y: Math.min(Math.max(0, y), window.innerHeight - TAMANHO),
  };
}

function lerPosicaoGuardada() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CHAVE_POSICAO));
    if (Number.isFinite(guardada?.x) && Number.isFinite(guardada?.y)) {
      return guardada;
    }
  } catch {
    // localStorage indisponível ou valor inválido: usa a posição por omissão.
  }
  return { x: window.innerWidth - TAMANHO - MARGEM, y: window.innerHeight - TAMANHO - MARGEM };
}

function guardarPosicao(posicao) {
  try {
    localStorage.setItem(CHAVE_POSICAO, JSON.stringify(posicao));
  } catch {
    // Sem localStorage a posição só dura até recarregar a página.
  }
}

async function pedirEstado() {
  const resposta = await fetch("/api/deploy", { cache: "no-store" });
  const dados = await resposta.json();
  if (!resposta.ok) {
    throw new Error(dados.erro ?? `Erro ${resposta.status}`);
  }
  return dados.pendente;
}

export default function DeployWidget() {
  const contentor = useRef(null);
  const posicao = useRef({ x: 0, y: 0 });
  const arrasto = useRef(null);

  const [pendente, setPendente] = useState(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [ladoPainel, setLadoPainel] = useState({ acima: true, direita: true });
  const [mensagem, setMensagem] = useState("WIP: sessão em curso");
  const [estadoDeploy, setEstadoDeploy] = useState(null);
  const [erro, setErro] = useState("");

  // A posição é aplicada diretamente no DOM para o arrasto não provocar re-renders.
  const aplicarPosicao = useCallback((nova) => {
    posicao.current = limitarAoEcra(nova);
    if (contentor.current) {
      contentor.current.style.left = `${posicao.current.x}px`;
      contentor.current.style.top = `${posicao.current.y}px`;
      contentor.current.style.visibility = "visible";
    }
  }, []);

  useEffect(() => {
    aplicarPosicao(lerPosicaoGuardada());
    const aoRedimensionar = () => aplicarPosicao(posicao.current);
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [aplicarPosicao]);

  // O estado só é atualizado nos callbacks da promessa (nunca de forma síncrona dentro do efeito).
  const carregarEstado = useCallback(() => {
    return pedirEstado().then(setPendente, (e) => {
      setPendente(null);
      setErro(e.message);
    });
  }, []);

  useEffect(() => {
    carregarEstado();
    const intervalo = setInterval(carregarEstado, INTERVALO_ESTADO_MS);
    return () => clearInterval(intervalo);
  }, [carregarEstado]);

  function aoPremir(evento) {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    arrasto.current = { inicioX: evento.clientX, inicioY: evento.clientY, origem: posicao.current, moveu: false };
  }

  function aoMover(evento) {
    const atual = arrasto.current;
    if (!atual) {
      return;
    }
    const dx = evento.clientX - atual.inicioX;
    const dy = evento.clientY - atual.inicioY;
    if (!atual.moveu && Math.hypot(dx, dy) < LIMIAR_ARRASTO) {
      return;
    }
    atual.moveu = true;
    aplicarPosicao({ x: atual.origem.x + dx, y: atual.origem.y + dy });
  }

  function aoLargar() {
    const atual = arrasto.current;
    arrasto.current = null;
    if (!atual) {
      return;
    }
    if (atual.moveu) {
      guardarPosicao(posicao.current);
      return;
    }
    setLadoPainel({
      acima: posicao.current.y > ALTURA_PAINEL,
      direita: posicao.current.x + TAMANHO > LARGURA_PAINEL,
    });
    setPainelAberto((aberto) => !aberto);
  }

  async function fazerDeploy() {
    setEstadoDeploy("a correr");
    setErro("");
    try {
      const resposta = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro ?? `Erro ${resposta.status}`);
      }
      setEstadoDeploy("sucesso");
    } catch (e) {
      setEstadoDeploy("erro");
      setErro(e.message);
    }
    carregarEstado();
  }

  const corFundo = pendente === false ? "bg-green-600" : "bg-gray-500";
  const aCorrer = estadoDeploy === "a correr";

  return (
    <div ref={contentor} className="fixed z-50" style={{ left: 0, top: 0, visibility: "hidden" }}>
      <button
        type="button"
        onPointerDown={aoPremir}
        onPointerMove={aoMover}
        onPointerUp={aoLargar}
        onPointerCancel={() => (arrasto.current = null)}
        className={`relative flex h-24 w-24 cursor-grab touch-none select-none items-center justify-center rounded-full
          text-center text-sm font-semibold leading-tight text-white shadow-lg active:cursor-grabbing ${corFundo}`}
        aria-label="Deploy ONLINE"
      >
        {pendente && (
          <span className="absolute right-2 top-2 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>
        )}
        Deploy
        <br />
        ONLINE
      </button>

      {painelAberto && (
        <div
          className={`absolute w-72 rounded-lg bg-white p-4 text-sm text-gray-900 shadow-xl
            ${ladoPainel.acima ? "bottom-full mb-2" : "top-full mt-2"} ${ladoPainel.direita ? "right-0" : "left-0"}`}
        >
          <label htmlFor="deploy-mensagem" className="mb-1 block font-medium">
            Mensagem do commit
          </label>
          <input
            id="deploy-mensagem"
            type="text"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className="mb-3 w-full rounded border border-gray-300 px-2 py-1"
          />
          <button
            type="button"
            onClick={fazerDeploy}
            disabled={aCorrer || mensagem.trim() === ""}
            className="w-full rounded bg-gray-900 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            Commit + Push
          </button>
          <p className="mt-3" role="status">
            Estado:{" "}
            {estadoDeploy === "a correr" && <span className="text-amber-600">a correr…</span>}
            {estadoDeploy === "sucesso" && <span className="text-green-700">sucesso</span>}
            {estadoDeploy === "erro" && <span className="text-red-700">erro</span>}
            {estadoDeploy === null && <span className="text-gray-500">—</span>}
          </p>
          {erro && <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-red-700">{erro}</p>}
        </div>
      )}
    </div>
  );
}
