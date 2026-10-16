import BotaoReservar from "./BotaoReservar";

// reservasPorSala: Map salaId → [{ id, intervalo, inicioIso, numeroPessoas }], já formatadas em hora de Lisboa.
// Sem reservasPorSala (ainda a carregar), os cartões mostram as salas e um aviso de carregamento.
function ReservasDaSala({ reservas }) {
  if (!reservas) {
    return <p className="text-sm text-sky-200/60">A carregar reservas…</p>;
  }
  if (0 === reservas.length) {
    return <p className="text-sm text-sky-200/60">Sem reservas.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {reservas.map((reserva) => (
        <li key={reserva.id} className="flex flex-wrap justify-between gap-x-3 text-sm">
          <time dateTime={reserva.inicioIso} className="font-mono text-sky-300">
            {reserva.intervalo}
          </time>
          <span className="text-sky-200/80">
            {reserva.numeroPessoas} {1 === reserva.numeroPessoas ? "pessoa" : "pessoas"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ListaSalas({ salas, reservasPorSala }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      {salas.map((sala) => (
        <li
          key={sala.id}
          className="flex flex-col gap-4 rounded-xl border border-sky-200/15 bg-white/5 p-5 shadow-lg shadow-black/20 backdrop-blur-sm"
        >
          <div className="flex flex-col gap-2">
            <p className="text-lg font-semibold text-white">{sala.nome}</p>
            <p className="w-fit rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-200">
              <span className="sr-only">Capacidade: </span>
              {sala.capacidade} pessoas
            </p>
          </div>
          <section aria-label={`Reservas da ${sala.nome}`} className="flex flex-col gap-2 border-t border-sky-200/10 pt-3">
            <h3 className="text-sm font-medium text-sky-100">Reservas</h3>
            <ReservasDaSala reservas={reservasPorSala?.get(sala.id) ?? (reservasPorSala ? [] : null)} />
          </section>
          <BotaoReservar salaId={sala.id} nomeSala={sala.nome} capacidade={sala.capacidade} />
        </li>
      ))}
    </ul>
  );
}
