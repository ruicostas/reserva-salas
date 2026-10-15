"use client";

import { useRef } from "react";

// text-base (16px) evita o zoom automático do iPhone ao tocar num campo.
const CLASSE_CAMPO =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-300/20";

const CLASSE_ROTULO = "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";

const CLASSE_BOTAO_PRINCIPAL =
  "min-h-11 w-full rounded-lg bg-zinc-900 px-4 text-base font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-50";

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
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-5 shadow-xl backdrop:bg-black/50 sm:p-6 dark:bg-zinc-900"
      >
        <form ref={formularioRef} onSubmit={submeter} className="flex flex-col gap-5">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reservar {nomeSala}</h2>

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
              className="min-h-11 w-full rounded-lg border border-zinc-300 px-4 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:w-auto dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-50"
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
