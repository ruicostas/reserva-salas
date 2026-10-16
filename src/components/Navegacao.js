"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LIGACOES = [
  { href: "/", texto: "Salas" },
  { href: "/reservas", texto: "As minhas reservas" },
];

export default function Navegacao() {
  const caminhoAtual = usePathname();

  return (
    <nav className="border-b border-sky-200/15 bg-[#04122e]/70 backdrop-blur-md">
      <ul className="mx-auto flex w-full max-w-3xl gap-1 px-4 sm:px-6">
        {LIGACOES.map((ligacao) => {
          const ativa = caminhoAtual === ligacao.href;
          return (
            <li key={ligacao.href}>
              <Link
                href={ligacao.href}
                aria-current={ativa ? "page" : undefined}
                className={`flex min-h-12 items-center border-b-2 px-3 text-base font-medium transition-colors ${
                  ativa
                    ? "border-sky-400 text-white"
                    : "border-transparent text-sky-200/70 hover:text-white"
                }`}
              >
                {ligacao.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
