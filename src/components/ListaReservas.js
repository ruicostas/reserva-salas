// timeZone UTC: as datas "AAAA-MM-DD" são lidas como UTC, por isso também se formatam em UTC para não mudar de dia.
const FORMATO_DATA = new Intl.DateTimeFormat("pt-PT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function ListaReservas({ reservas }) {
  return (
    <ul className="grid gap-3 sm:gap-4">
      {reservas.map((reserva) => (
        <li
          key={reserva.id}
          className="flex flex-col gap-4 rounded-xl border border-sky-200/15 bg-white/5 p-5 shadow-lg shadow-black/20 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-white">{reserva.nomeSala}</p>
            <p className="text-base text-sky-100 first-letter:uppercase">
              <time dateTime={reserva.data}>{FORMATO_DATA.format(new Date(reserva.data))}</time>
            </p>
            <p className="font-mono text-base text-sky-300">
              <time dateTime={reserva.horaInicio}>{reserva.horaInicio}</time>
              {" – "}
              <time dateTime={reserva.horaFim}>{reserva.horaFim}</time>
            </p>
          </div>
          <button
            type="button"
            className="min-h-11 w-full rounded-lg border border-red-400/50 px-4 text-base font-medium text-red-300 transition-colors hover:bg-red-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 sm:w-auto"
          >
            Cancelar
          </button>
        </li>
      ))}
    </ul>
  );
}
