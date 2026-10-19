"use server";

// Server Actions: correm sempre no servidor. Os casos de uso chegam já ligados ao repositório através de composicao.js.
import { refresh } from "next/cache";
import { reservarSalaNaApp } from "./composicao.js";
import { diaSeguinte, lisboaParaUtc } from "./fusoLisboa.js";
import { mensagemDeErro } from "./mensagensErro.js";

function falha(codigo) {
  return { sucesso: false, mensagem: mensagemDeErro(codigo) };
}

/**
 * Server Action do formulário de reserva (para useActionState).
 * A data e as horas chegam em hora de Lisboa e são convertidas explicitamente para UTC antes de chamar o caso de uso.
 */
export async function reservarSalaAction(_estadoAnterior, formData) {
  // O id da sala é o UUID da base de dados, usado como texto. Um id que não exista dá SALA_INEXISTENTE no caso de uso.
  const salaId = String(formData.get("salaId") ?? "");
  const data = formData.get("data");
  const horaInicio = formData.get("horaInicio");
  const horaFim = formData.get("horaFim");
  const numeroPessoasTexto = formData.get("numeroPessoas");

  // Uma Server Action pode ser chamada por um POST direto, por isso os dados são validados aqui e não só no browser.
  if (!data || !horaInicio || !horaFim || !numeroPessoasTexto) {
    return falha("CAMPOS_EM_FALTA");
  }

  // Hora de fim menor do que a de início: a reserva atravessa a meia-noite e termina no dia seguinte.
  // (Comparação de texto "HH:MM" funciona porque ambas têm o mesmo formato; horas iguais ficam no mesmo dia.)
  const dataFim = horaFim < horaInicio ? diaSeguinte(data) : data;
  const inicio = lisboaParaUtc(data, horaInicio);
  const fim = lisboaParaUtc(dataFim, horaFim);
  if (null === inicio || null === fim) {
    // Data existente e horas bem escritas, mas sem instante em Lisboa: só acontece no salto para a hora de verão.
    const dataExiste = null !== lisboaParaUtc(data, "12:00");
    const horasBemEscritas = [horaInicio, horaFim].every((hora) => /^([01]\d|2[0-3]):[0-5]\d$/.test(hora));
    return falha(dataExiste && horasBemEscritas ? "HORA_INEXISTENTE" : "RESERVA_DATA_INVALIDA");
  }

  // Number("2.5") e Number("abc") não são inteiros válidos: o domínio rejeita-os com RESERVA_NUMERO_PESSOAS_INVALIDO.
  const numeroPessoas = Number(numeroPessoasTexto);
  const resultado = await reservarSalaNaApp({ salaId, inicio, fim, numeroPessoas });
  if (!resultado.sucesso) {
    return falha(resultado.erro);
  }

  // Atualiza a página no browser, para a nova reserva aparecer no cartão da sala.
  refresh();
  return { sucesso: true };
}
