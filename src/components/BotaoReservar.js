"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { reservarSalaAction } from "../app/actions";

// text-base (16px) evita o zoom automático do iPhone ao tocar num campo.
const CLASSE_CAMPO =
  "min-h-11 w-full rounded-lg border border-sky-200/20 bg-white/5 px-3 text-base text-white " +
  "focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30";

const CLASSE_ROTULO = "flex flex-col gap-1.5 text-sm font-medium text-sky-100";

const CLASSE_BOTAO_PRINCIPAL =
  "min-h-11 w-full rounded-lg bg-sky-400 px-4 text-base font-semibold text-slate-950 shadow-[0_0_20px_rgb(56_189_248/0.35)] transition-colors " +
  "hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300";

const CLASSE_DIALOGO =
  "m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-sky-300/25 bg-[#072a6b] p-5 text-white shadow-2xl " +
  "shadow-sky-500/20 backdrop:bg-[#020817]/70 backdrop:backdrop-blur-sm sm:p-6";

const CLASSE_BOTAO_SECUNDARIO =
  "min-h-11 w-full rounded-lg border border-sky-200/30 px-4 text-base font-medium text-sky-100 transition-colors hover:bg-white/10 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:w-auto";

export default function BotaoReservar({ salaId, nomeSala, capacidade }) {
  const dialogoRef = useRef(null);
  const formularioRef = useRef(null);
  // A reserva é feita no servidor (Server Action); aqui só se recebe { sucesso } ou { sucesso: false, mensagem }.
  const [estado, executarReserva, aReservar] = useActionState(reservarSalaAction, null);
  // Resultado já visto e fechado pelo utilizador: a mensagem de erro não volta a aparecer ao reabrir.
  const [estadoDispensado, setEstadoDispensado] = useState(null);
  const mensagemErro = estado && !estado.sucesso && estado !== estadoDispensado ? estado.mensagem : null;

  useEffect(() => {
    if (estado?.sucesso) {
      dialogoRef.current.close();
    }
  }, [estado]);

  function abrir() {
    dialogoRef.current.showModal();
  }

  function fechar() {
    dialogoRef.current.close();
  }

  // Todas as formas de fechar (Cancelar, Esc, sucesso) passam por aqui.
  function aoFechar() {
    formularioRef.current.reset();
    setEstadoDispensado(estado);
  }

  // Chamada manual em vez de <form action>: assim o formulário não é limpo quando há erro e o utilizador pode corrigir.
  function submeter(evento) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    startTransition(() => executarReserva(dados));
  }

  return (
    <>
      <button type="button" onClick={abrir} className={`${CLASSE_BOTAO_PRINCIPAL} mt-auto`}>
        Reservar
      </button>

      <dialog
        ref={dialogoRef}
        onClose={aoFechar}
        className={CLASSE_DIALOGO}
      >
        <form ref={formularioRef} onSubmit={submeter} className="flex flex-col gap-5">
          <h2 className="text-xl font-semibold text-white">Reservar {nomeSala}</h2>
          <input type="hidden" name="salaId" value={salaId} />
          <p className="-mt-3 text-sm text-sky-200/80">
            Hora de Lisboa · máximo 2 horas. Se a hora de fim for anterior à de início, termina no dia seguinte.
          </p>

          <label className={CLASSE_ROTULO}>
            Data da reserva
            <input type="date" name="data" required className={CLASSE_CAMPO} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={CLASSE_ROTULO}>
              Hora de início
              <input type="time" name="horaInicio" required className={CLASSE_CAMPO} />
            </label>

            <label className={CLASSE_ROTULO}>
              Hora de fim
              <input type="time" name="horaFim" required className={CLASSE_CAMPO} />
            </label>
          </div>

          <label className={CLASSE_ROTULO}>
            Número de pessoas (máx. {capacidade})
            <input type="number" name="numeroPessoas" required min={1} max={capacidade} step={1} inputMode="numeric" className={CLASSE_CAMPO} />
          </label>

          {mensagemErro && (
            <p role="alert" className="rounded-lg border border-red-400/50 bg-red-500/15 px-3 py-2 text-sm text-red-200">
              {mensagemErro}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={fechar}
              className={CLASSE_BOTAO_SECUNDARIO}
            >
              Cancelar
            </button>
            <button type="submit" disabled={aReservar} className={`${CLASSE_BOTAO_PRINCIPAL} disabled:opacity-60 sm:w-auto`}>
              {aReservar ? "A reservar…" : "Confirmar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
