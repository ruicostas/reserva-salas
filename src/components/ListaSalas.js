import BotaoReservar from "./BotaoReservar";

export default function ListaSalas({ salas }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      {salas.map((sala) => (
        <li
          key={sala.id}
          className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex flex-col gap-2">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{sala.nome}</p>
            <p className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <span className="sr-only">Capacidade: </span>
              {sala.capacidade} pessoas
            </p>
          </div>
          <BotaoReservar nomeSala={sala.nome} />
        </li>
      ))}
    </ul>
  );
}
