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
          className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{reserva.nomeSala}</p>
            <p className="text-base text-zinc-700 first-letter:uppercase dark:text-zinc-300">
              <time dateTime={reserva.data}>{FORMATO_DATA.format(new Date(reserva.data))}</time>
            </p>
            <p className="text-base text-zinc-600 dark:text-zinc-400">
              <time dateTime={reserva.horaInicio}>{reserva.horaInicio}</time>
              {" – "}
              <time dateTime={reserva.horaFim}>{reserva.horaFim}</time>
            </p>
          </div>
          <button
            type="button"
            className="min-h-11 w-full rounded-lg border border-red-300 px-4 text-base font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:w-auto dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Cancelar
          </button>
        </li>
      ))}
    </ul>
  );
}
