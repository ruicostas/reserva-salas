"use client";

import { useRef } from "react";

// text-base (16px) evita o zoom automático do iPhone ao tocar num campo.
const CLASSE_CAMPO =
  "min-h-11 w-full rounded-lg border border-sky-200/20 bg-white/5 px-3 text-base text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30";

const CLASSE_ROTULO = "flex flex-col gap-1.5 text-sm font-medium text-sky-100";

const CLASSE_BOTAO_PRINCIPAL =
  "min-h-11 w-full rounded-lg bg-sky-400 px-4 text-base font-semibold text-slate-950 shadow-[0_0_20px_rgb(56_189_248/0.35)] transition-colors hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300";

export default function BotaoReservar({ nomeSala }) {
  const dialogoRef = useRef(null);
  const formularioRef = useRef(null);

  function abrir() {
    dialogoRef.current.showModal();
  }

  function fechar() {
    formularioRef.current.reset();
    dialogoRef.current.close();
  }

  // Ainda não guarda nada: submeter apenas fecha o formulário.
  function submeter(evento) {
    evento.preventDefault();
    fechar();
  }

  return (
    <>
      <button type="button" onClick={abrir} className={`${CLASSE_BOTAO_PRINCIPAL} mt-auto`}>
        Reservar
      </button>

      <dialog
        ref={dialogoRef}
        onClose={() => formularioRef.current.reset()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-sky-300/25 bg-[#072a6b] p-5 text-white shadow-2xl shadow-sky-500/20 backdrop:bg-[#020817]/70 backdrop:backdrop-blur-sm sm:p-6"
      >
        <form ref={formularioRef} onSubmit={submeter} className="flex flex-col gap-5">
          <h2 className="text-xl font-semibold text-white">Reservar {nomeSala}</h2>

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

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={fechar}
              className="min-h-11 w-full rounded-lg border border-sky-200/30 px-4 text-base font-medium text-sky-100 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:w-auto"
            >
              Cancelar
            </button>
            <button type="submit" className={`${CLASSE_BOTAO_PRINCIPAL} sm:w-auto`}>
              Confirmar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
