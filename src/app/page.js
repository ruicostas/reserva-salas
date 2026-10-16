import ListaSalas from "../components/ListaSalas";

// Dados de exemplo fixos: serão substituídos pelo caso de uso listarSalas quando existir a camada aplicacional.
const SALAS_EXEMPLO = [
  { id: 1, nome: "Sala Atlântico", capacidade: 12 },
  { id: 2, nome: "Sala Douro", capacidade: 6 },
  { id: 3, nome: "Sala Tejo", capacidade: 20 },
  { id: 4, nome: "Sala Mondego", capacidade: 4 },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Salas disponíveis</h1>
        <p className="text-base text-sky-200/80">Escolha uma sala e indique a data e o horário.</p>
      </header>
      <ListaSalas salas={SALAS_EXEMPLO} />
    </main>
  );
}
