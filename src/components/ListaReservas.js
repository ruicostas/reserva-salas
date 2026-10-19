// reservas: [{ id, nomeSala, intervalo, inicioIso, numeroPessoas }], já formatadas em hora de Lisboa pela página.
const CLASSE_CARTAO =
  "flex flex-col gap-4 rounded-xl border border-sky-200/15 bg-white/5 p-5 shadow-lg shadow-black/20 backdrop-blur-sm " +
  "sm:flex-row sm:items-center sm:justify-between";

const CLASSE_BOTAO_CANCELAR =
  "min-h-11 w-full rounded-lg border border-red-400/50 px-4 text-base font-medium text-red-300 transition-colors " +
  "hover:bg-red-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 sm:w-auto";

export default function ListaReservas({ reservas }) {
  if (reservas.length === 0) {
    return <p className="text-base text-sky-200/60">Ainda não há reservas.</p>;
  }

  return (
    <ul className="grid gap-3 sm:gap-4">
      {reservas.map((reserva) => (
        <li key={reserva.id} className={CLASSE_CARTAO}>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-white">{reserva.nomeSala ?? "Sala removida"}</p>
            <p className="font-mono text-base text-sky-300 first-letter:uppercase">
              <time dateTime={reserva.inicioIso}>{reserva.intervalo}</time>
            </p>
            <p className="text-base text-sky-200/80">
              {reserva.numeroPessoas} {reserva.numeroPessoas === 1 ? "pessoa" : "pessoas"}
            </p>
          </div>
          <button type="button" className={CLASSE_BOTAO_CANCELAR}>
            Cancelar
          </button>
        </li>
      ))}
    </ul>
  );
}
