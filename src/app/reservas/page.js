import ListaReservas from "../../components/ListaReservas";

export const metadata = {
  title: "As minhas reservas · Reserva de Salas",
};

// Dados de exemplo fixos: serão substituídos por um caso de uso da camada aplicacional.
const RESERVAS_EXEMPLO = [
  { id: 1, nomeSala: "Sala Atlântico", data: "2026-10-20", horaInicio: "09:30", horaFim: "11:00" },
  { id: 2, nomeSala: "Sala Douro", data: "2026-10-22", horaInicio: "14:00", horaFim: "15:00" },
  { id: 3, nomeSala: "Sala Tejo", data: "2026-10-27", horaInicio: "10:00", horaFim: "12:30" },
];

export default function MinhasReservas() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">As minhas reservas</h1>
        <p className="text-base text-sky-200/80">Reservas que fez e que ainda não terminaram.</p>
      </header>
      <ListaReservas reservas={RESERVAS_EXEMPLO} />
    </main>
  );
}
