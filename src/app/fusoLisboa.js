const FUSO = "Europe/Lisbon";
const UMA_HORA_MS = 60 * 60 * 1000;

const FORMATO_LISBOA = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Data e hora de parede em Lisboa para um instante, como { ano, mes, dia, hora, minuto }.
function horaDeParedeEmLisboa(instanteMs) {
  const partes = Object.fromEntries(FORMATO_LISBOA.formatToParts(new Date(instanteMs)).map((p) => [p.type, Number(p.value)]));
  return { ano: partes.year, mes: partes.month, dia: partes.day, hora: partes.hour, minuto: partes.minute };
}

// Diferença (ms) entre a hora de Lisboa e UTC nesse instante: 0 no inverno (WET), 1 h no verão (WEST).
function desvioDeLisboa(instanteMs) {
  const p = horaDeParedeEmLisboa(instanteMs);
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) - instanteMs;
}

/**
 * Converte uma data ("AAAA-MM-DD") e uma hora ("HH:MM") de Lisboa no instante UTC correspondente.
 * Devolve null se o texto for inválido ou se a hora não existir em Lisboa (salto para a hora de verão, em março).
 * Na passagem para a hora de inverno (outubro) uma hora repete-se; nesse caso escolhe-se a primeira ocorrência.
 */
export function lisboaParaUtc(data, hora) {
  const mData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data ?? "");
  const mHora = /^(\d{2}):(\d{2})$/.exec(hora ?? "");
  if (!mData || !mHora) {
    return null;
  }
  const pedido = { ano: Number(mData[1]), mes: Number(mData[2]), dia: Number(mData[3]), hora: Number(mHora[1]), minuto: Number(mHora[2]) };

  // A hora de parede lida como se fosse UTC; o instante real difere dela pelo desvio de Lisboa nesse momento.
  const comoSeFosseUtc = Date.UTC(pedido.ano, pedido.mes - 1, pedido.dia, pedido.hora, pedido.minuto);
  const desvios = new Set([desvioDeLisboa(comoSeFosseUtc - 12 * UMA_HORA_MS), desvioDeLisboa(comoSeFosseUtc + 12 * UMA_HORA_MS)]);

  // Só são válidos os candidatos que, convertidos de volta para Lisboa, dão exatamente a data e hora pedidas.
  const candidatos = [...desvios]
    .map((desvio) => comoSeFosseUtc - desvio)
    .filter((instante) => {
      const p = horaDeParedeEmLisboa(instante);
      return p.ano === pedido.ano && p.mes === pedido.mes && p.dia === pedido.dia && p.hora === pedido.hora && p.minuto === pedido.minuto;
    });

  if (0 === candidatos.length) {
    return null;
  }
  return new Date(Math.min(...candidatos));
}

const FORMATO_DIA = new Intl.DateTimeFormat("pt-PT", {
  timeZone: FUSO,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const FORMATO_HORA = new Intl.DateTimeFormat("pt-PT", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * Texto de um intervalo em hora de Lisboa, ex.: "terça, 10/11/2026 · 10:00–11:00".
 * Se o fim for noutro dia (em Lisboa), mostra também o dia do fim.
 */
export function formatarIntervaloLisboa(inicio, fim) {
  const diaInicio = FORMATO_DIA.format(inicio);
  const diaFim = FORMATO_DIA.format(fim);
  if (diaInicio === diaFim) {
    return `${diaInicio} · ${FORMATO_HORA.format(inicio)}–${FORMATO_HORA.format(fim)}`;
  }
  return `${diaInicio} ${FORMATO_HORA.format(inicio)} – ${diaFim} ${FORMATO_HORA.format(fim)}`;
}

/**
 * Dia seguinte a uma data "AAAA-MM-DD", no mesmo formato (calendário, sem fuso horário).
 * Devolve null se o texto não for uma data válida.
 */
export function diaSeguinte(data) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data ?? "");
  if (!m) {
    return null;
  }
  const dia = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (dia.toISOString().slice(0, 10) !== data) {
    return null;
  }
  dia.setUTCDate(dia.getUTCDate() + 1);
  return dia.toISOString().slice(0, 10);
}
