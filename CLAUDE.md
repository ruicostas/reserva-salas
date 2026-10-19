# reserva-salas

@AGENTS.md

## Stack

- Next.js (App Router), JavaScript, Tailwind CSS.
- Testes: Vitest (`vitest.config.js`, ficheiros `src/**/*.test.js`).
- Deploy: Vercel.
- Base de dados: PostgreSQL no Aiven (pacote `pg`).

## Arquitetura em 4 camadas

| Camada | Pasta(s) | Pode importar de |
|---|---|---|
| Apresentação | `src/app/`, `src/components/` | `src/aplicacional/` (ver exceção abaixo) |
| Aplicacional | `src/aplicacional/` | `src/dominio/` e os repositórios recebidos por parâmetro |
| Domínio | `src/dominio/` | nenhuma outra camada |
| Persistência | `src/persistencia/` | `src/dominio/` |

- Não existe pasta `src/apresentacao/`: a apresentação são as páginas e componentes Next.js.
- O domínio não depende de nenhuma outra camada e não sabe nada sobre a interface (React, Next.js, Tailwind, textos de ecrã).
  - Os erros de domínio têm um código (ex.: `SALA_OCUPADA`); a apresentação converte o código na mensagem para o utilizador.
  - A hora atual entra como parâmetro (ex.: `validarReserva(reserva, agora)`); o domínio não lê o relógio.
- A apresentação só comunica com a camada aplicacional.
- Exceção: um único ficheiro de composição, `src/app/composicao.js`, cria o repositório e entrega-o aos casos de uso.
  É o único sítio da apresentação que importa de `src/persistencia/`. `src/app/actions.js` só tem Server Actions
  (um ficheiro `"use server"` só pode exportar funções assíncronas).
- As chamadas à base de dados só existem em `src/persistencia/`.
- Exceção de ferramentas de desenvolvimento: o widget de deploy (`src/components/DeployWidget.js`, `src/app/api/deploy/`)
  fica fora das 4 camadas, não importa de nenhuma e só existe com `NODE_ENV === "development"`.

## Persistência: PostgreSQL no Aiven

- A app usa `src/persistencia/repositorioPostgres.js`; o repositório em memória fica só para testes (contrato e unitários).
- A ligação é sempre criada com `criarLigacao` (`src/persistencia/ligacao.js`):
  - sempre cifrada e com o certificado do Aiven verificado (`ssl: { ca, rejectUnauthorized: true }`); nunca desligar a verificação;
  - o endereço é lido em campos separados; os parâmetros `sslmode`, `sslrootcert`, etc. do endereço são ignorados;
  - o endereço, o utilizador e a palavra-passe nunca aparecem em mensagens nem em registos (usar `mensagemSegura`).
- As consultas são texto fixo com parâmetros (`$1`, `$2`, ...); nunca colar no SQL valores vindos do utilizador.
- A app entra como `app_reservas`, que só tem `SELECT, INSERT, UPDATE, DELETE` em `salas` e `reservas`.
- O esquema muda só com `npm run migrar` (`src/persistencia/esquema.js`), que corre no computador local com o administrador.
- `npm run verificar-ligacao` confirma a cifra, o certificado, o utilizador e as permissões, sem deixar nada gravado.

## Datas e horas

- As datas são guardadas em `timestamptz` e tratadas como `Date` (instante em UTC) no domínio e na camada aplicacional.
- A conversão de/para a hora de Lisboa é feita só na apresentação, de forma explícita (`src/app/fusoLisboa.js`).
- As durações contam-se em tempo real (`fim − início`), também nos dias de mudança de hora.

## Segurança

- Variáveis de ambiente sensíveis e credenciais (`DATABASE_URL`, etc.) nunca aparecem em código do lado do cliente.
- Não usar o prefixo `NEXT_PUBLIC_` em variáveis sensíveis, nem importar código que as lê em componentes com `"use client"`.
- Variáveis da base de dados:

  | Variável | Para quê | Onde existe |
  |---|---|---|
  | `DATABASE_URL` | ligação da app, como `app_reservas` | `.env.local` e Vercel |
  | `DATABASE_CA_CERT` | certificado (CA) do Aiven, em PEM | `.env.local` e Vercel |
  | `DATABASE_ADMIN_URL` | administrador, só para `npm run migrar` | **só no `.env.local` do computador local; nunca na Vercel** |

- O `.env.local` nunca é lido nem mostrado pelo assistente; os testes usam valores falsos.

## Testes

- A lógica de domínio, aplicacional e persistência só está concluída quando tiver testes validados.
- Não alterar os testes apenas para os fazer passar; se um teste falha, corrigir o código ou justificar a mudança do teste.
- Os repositórios cumprem o contrato em `src/persistencia/contratoRepositorio.js`.
  `npm run test` nunca liga à base de dados real; o contrato contra o Aiven corre só com `npm run test:postgres`
  (escreve e apaga dados de teste em salas `[teste-contrato]`).

## Forma de trabalhar

- Antes de implementar, apresentar sempre um plano curto.
- Antes de instalar uma dependência, indicar qual é e para que serve.
- Antes de dar uma tarefa por concluída, correr `npm run test`, `npm run lint` e `npm run build`, e todos têm de passar.
- No fim de cada tarefa, explicar o que foi feito em linguagem simples.
