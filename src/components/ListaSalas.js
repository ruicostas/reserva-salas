import BotaoReservar from "./BotaoReservar";

export default function ListaSalas({ salas }) {
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
          <BotaoReservar nomeSala={sala.nome} />
        </li>
      ))}
    </ul>
  );
}
