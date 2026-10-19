import { connection } from "next/server";
import { Suspense } from "react";
import ListaReservas from "../../components/ListaReservas";
import { listarReservasNaApp } from "../composicao";
import { formatarIntervaloLisboa } from "../fusoLisboa";

export const metadata = {
  title: "As minhas reservas · Reserva de Salas",
};

// Lê as reservas da base de dados a cada pedido, já ordenadas por início, e formata-as em hora de Lisboa.
async function ReservasDaBaseDeDados() {
  // Dados por pedido: sem connection() a leitura poderia acontecer no build e ficar congelada.
  await connection();
  const reservas = await listarReservasNaApp();

  return (
    <ListaReservas
      reservas={reservas.map((reserva) => ({
        id: reserva.id,
        nomeSala: reserva.nomeSala,
        intervalo: formatarIntervaloLisboa(reserva.inicio, reserva.fim),
        inicioIso: reserva.inicio.toISOString(),
        numeroPessoas: reserva.numeroPessoas,
      }))}
    />
  );
}

export default function MinhasReservas() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">As minhas reservas</h1>
        <p className="text-base text-sky-200/80">Todas as reservas registadas, por ordem de início.</p>
      </header>
      <Suspense fallback={<p className="text-base text-sky-200/60">A carregar reservas…</p>}>
        <ReservasDaBaseDeDados />
      </Suspense>
    </main>
  );
}
