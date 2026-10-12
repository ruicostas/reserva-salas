# reserva-salas

@AGENTS.md

## Stack

- Next.js (App Router), JavaScript, Tailwind CSS.
- Testes: Vitest (`vitest.config.js`, ficheiros `src/**/*.test.js`).
- Deploy: Vercel.
- Base de dados: PostgreSQL no Aiven.

## Arquitetura em 4 camadas

| Camada | Pasta(s) | Pode importar de |
|---|---|---|
| Apresentação | `src/app/`, `src/components/` | `src/aplicacional/` (ver exceção abaixo) |
| Aplicacional | `src/aplicacional/` | `src/dominio/` e os repositórios recebidos por parâmetro |
| Domínio | `src/dominio/` | nenhuma outra camada |
| Persistência | `src/persistencia/` | `src/dominio/` |

- Não existe pasta `src/apresentacao/`: a apresentação são as páginas e componentes Next.js.
- O domínio não depende de nenhuma outra camada.
- A apresentação só comunica com a camada aplicacional.
- Exceção: um único ficheiro de composição (ex.: `src/app/actions.js`) cria o repositório e entrega-o aos casos de uso.
  É o único sítio da apresentação que importa de `src/persistencia/`.
- As chamadas à base de dados só existem em `src/persistencia/`.
- Exceção de ferramentas de desenvolvimento: o widget de deploy (`src/components/DeployWidget.js`, `src/app/api/deploy/`)
  fica fora das 4 camadas, não importa de nenhuma e só existe com `NODE_ENV === "development"`.

## Segurança

- Variáveis de ambiente sensíveis e credenciais (`DATABASE_URL`, etc.) nunca aparecem em código do lado do cliente.
- Não usar o prefixo `NEXT_PUBLIC_` em variáveis sensíveis, nem importar código que as lê em componentes com `"use client"`.

## Testes

- A lógica de domínio, aplicacional e persistência só está concluída quando tiver testes validados.
- Não alterar os testes apenas para os fazer passar; se um teste falha, corrigir o código ou justificar a mudança do teste.

## Forma de trabalhar

- Antes de implementar, apresentar sempre um plano curto.
- Antes de instalar uma dependência, indicar qual é e para que serve.
- Antes de dar uma tarefa por concluída, correr `npm run test`, `npm run lint` e `npm run build`, e todos têm de passar.
- No fim de cada tarefa, explicar o que foi feito em linguagem simples.
