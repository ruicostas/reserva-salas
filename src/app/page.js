import { connection } from "next/server";
import { Suspense } from "react";
import ListaSalas from "../components/ListaSalas";
import { listarReservasNaApp } from "./composicao";
import { SALAS_EXEMPLO } from "./dadosExemplo";
import { formatarIntervaloLisboa } from "./fusoLisboa";

// Lê as reservas a cada pedido e agrupa-as por sala, já formatadas em hora de Lisboa.
async function SalasComReservas() {
  // O repositório em memória responde de imediato: sem connection() a leitura ficaria congelada no build.
  await connection();
  const reservas = await listarReservasNaApp();

  const reservasPorSala = new Map();
  for (const reserva of reservas) {
    const daSala = reservasPorSala.get(reserva.salaId) ?? [];
    daSala.push({
      id: reserva.id,
      intervalo: formatarIntervaloLisboa(reserva.inicio, reserva.fim),
      inicioIso: reserva.inicio.toISOString(),
      numeroPessoas: reserva.numeroPessoas,
    });
    reservasPorSala.set(reserva.salaId, daSala);
  }

  return <ListaSalas salas={SALAS_EXEMPLO} reservasPorSala={reservasPorSala} />;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Salas disponíveis</h1>
        <p className="text-base text-sky-200/80">Escolha uma sala e indique a data e o horário.</p>
      </header>
      {/* As salas aparecem logo; as reservas chegam a seguir, lidas no momento do pedido. */}
      <Suspense fallback={<ListaSalas salas={SALAS_EXEMPLO} />}>
        <SalasComReservas />
      </Suspense>
    </main>
  );
}
