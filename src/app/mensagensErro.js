// Tradução dos códigos de erro (do domínio, da camada aplicacional e da própria apresentação) para o texto mostrado no ecrã.
const MENSAGENS = Object.freeze({
  SALA_OCUPADA: "A sala já está reservada nesse horário. Escolha outro horário.",
  SALA_INEXISTENTE: "A sala escolhida não existe.",
  RESERVA_DATA_INVALIDA: "A data ou as horas não são válidas.",
  RESERVA_FIM_NAO_POSTERIOR_AO_INICIO: "A hora de fim tem de ser depois da hora de início.",
  RESERVA_DURACAO_MAXIMA_EXCEDIDA: "Uma reserva pode durar no máximo 2 horas.",
  CAPACIDADE_EXCEDIDA: "O número de pessoas é maior do que a capacidade da sala.",
  RESERVA_NUMERO_PESSOAS_INVALIDO: "Indique um número inteiro de pessoas, a partir de 1.",
  CAMPOS_EM_FALTA: "Preencha a data, as horas e o número de pessoas.",
  HORA_INEXISTENTE: "Essa hora não existe em Lisboa nesse dia, por causa da mudança para a hora de verão.",
  ERRO_INESPERADO: "Não foi possível guardar a reserva. Tente novamente.",
});

export function mensagemDeErro(codigo) {
  return MENSAGENS[codigo] ?? MENSAGENS.ERRO_INESPERADO;
}
