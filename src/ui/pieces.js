// Peças visuais compartilhadas. Todas obedecem à mesma regra de composição:
// o texto explica à esquerda, a quantia responde à direita, e um fio separa
// uma linha da outra. Sem caixa, sem cor de fundo, sem ícone decorativo.

import { esc, classes } from './dom.js';
import { formatarReais, formatarPercentual } from '../core/money.js';
import { formatarDataCurta, distanciaEmPalavras } from '../core/dates.js';
import { SITUACAO } from '../core/debt.js';
import { rotuloPeriodicidade } from '../core/schedule.js';

/**
 * Os números da operação: um valor grande, uma régua fina de proporção e três
 * linhas de extrato. Os quatro conceitos continuam todos na tela — o que mudou
 * é que só um deles pede a atenção.
 */
export function resumoFinanceiro(pano) {
  const proporcaoAtraso = pano.aReceberCents > 0
    ? Math.min(100, (pano.atrasadoCents / pano.aReceberCents) * 100)
    : 0;

  return `
    <div class="destaque">
      <span class="etiqueta">Em caixa</span>
      <span class="cifra cifra-heroi ${pano.emCaixaCents < 0 ? 'tom-atraso' : ''}">${esc(formatarReais(pano.emCaixaCents))}</span>
      ${pano.aReceberCents > 0 ? `<div class="regua">
        <span class="vencido" style="width:${proporcaoAtraso.toFixed(2)}%"></span>
      </div>` : ''}
    </div>
    <dl class="extrato">
      ${linhaExtrato('Na rua', formatarReais(pano.naRuaCents))}
      ${linhaExtrato('A receber', formatarReais(pano.aReceberCents))}
      ${linhaExtrato('Atrasado', formatarReais(pano.atrasadoCents), pano.atrasadoCents > 0 ? 'tom-atraso' : 'tom-fraco')}
    </dl>`;
}

/** Uma linha de extrato: rótulo à esquerda, quantia à direita. */
export function linhaExtrato(rotulo, valor, tom = '') {
  return `<div class="extrato-linha">
    <dt class="extrato-rotulo">${esc(rotulo)}</dt>
    <dd class="cifra cifra-peq ${tom}">${esc(valor)}</dd>
  </div>`;
}

/** Trio de valores para a ficha do cliente. */
export function trioDeValores(itens) {
  return `<dl class="extrato">${
    itens.map(i => linhaExtrato(i.rotulo, formatarReais(i.cents), i.tom || '')).join('')
  }</dl>`;
}

/** Uma parcela na agenda do Início. O toque abre o registro de pagamento. */
export function linhaAgenda(item, hojeIso) {
  const atrasada = item.situacao === SITUACAO.ATRASADA;
  const quando = atrasada
    ? `${item.diasDeAtraso} ${item.diasDeAtraso === 1 ? 'dia' : 'dias'} de atraso`
    : distanciaEmPalavras(item.vencimento, hojeIso);

  return `<button class="item" data-acao="pagar" data-divida="${esc(item.dividaId)}" data-parcela="${item.numero}">
    <span class="item-corpo">
      <span class="item-nome">${esc(item.clienteNome)}</span>
      <span class="item-sub">parcela ${item.numero} de ${item.totalParcelas} · ${esc(formatarDataCurta(item.vencimento))}${item.parcial ? ' · parcial' : ''}</span>
    </span>
    <span class="item-fim">
      <span class="cifra cifra-media">${esc(formatarReais(item.restanteCents))}</span>
      <span class="item-sub ${atrasada ? 'tom-atraso' : ''}">${esc(quando)}</span>
    </span>
  </button>`;
}

/** Lista de agenda com corte e uma linha discreta para o que ficou de fora. */
export function listaAgenda(itens, hojeIso, limite = 3) {
  const visiveis = itens.slice(0, limite);
  const restantes = itens.length - visiveis.length;
  return `<div class="itens">
    ${visiveis.map(i => linhaAgenda(i, hojeIso)).join('')}
    ${restantes > 0 ? `<span class="mais">e mais ${restantes} ${restantes === 1 ? 'parcela' : 'parcelas'}</span>` : ''}
  </div>`;
}

/** Situação do cliente em palavra, não em selo colorido. */
export function situacaoDoCliente(estado) {
  if (estado.situacao === 'atrasado') {
    const n = estado.contagem.parcelasAtrasadas;
    return { texto: `${n} ${n === 1 ? 'parcela atrasada' : 'parcelas atrasadas'}`, tom: 'tom-atraso' };
  }
  if (estado.situacao === 'quitado') return { texto: 'quitado', tom: 'tom-fraco' };
  if (estado.situacao === 'sem-dividas') return { texto: 'sem dívidas', tom: 'tom-fraco' };
  const n = estado.contagem.abertas;
  return { texto: `${n} ${n === 1 ? 'dívida aberta' : 'dívidas abertas'}`, tom: 'tom-fraco' };
}

/** Situação de uma dívida, também em palavra. */
export function situacaoDaDivida(estado) {
  if (estado.quitada) return { texto: 'quitada', tom: 'tom-fraco' };
  if (estado.emAtraso) {
    const n = estado.contagem.atrasadas;
    return { texto: `${n} ${n === 1 ? 'parcela atrasada' : 'parcelas atrasadas'}`, tom: 'tom-atraso' };
  }
  return { texto: 'em dia', tom: 'tom-fraco' };
}

/** Régua de progresso: quanto da dívida já foi recebido. */
export function progressoDivida(estado) {
  const feito = estado.totalCents > 0 ? (estado.aplicadoCents / estado.totalCents) * 100 : 0;
  return `<div class="regua" style="background:var(--linha-fina)">
    <span style="width:${Math.max(0, Math.min(100, feito)).toFixed(2)}%;background:var(--tinta-3)"></span>
  </div>`;
}

/** Os termos combinados, em uma linha. */
export function termosDaDivida(estado) {
  return `${formatarReais(estado.baseCents)} + ${formatarPercentual(estado.jurosPercentual)} · ` +
    `${rotuloPeriodicidade(estado.periodicidade).toLowerCase()} · ${estado.contagem.total} parcelas`;
}

/** Uma parcela na ficha da dívida. */
export function linhaParcela(parcela, dividaId, hojeIso) {
  const paga = parcela.situacao === SITUACAO.PAGA;
  const atrasada = parcela.situacao === SITUACAO.ATRASADA;

  const sub = paga
    ? (parcela.quitadaEm ? `paga em ${formatarDataCurta(parcela.quitadaEm)}` : 'paga')
    : atrasada
      ? `venceu ${distanciaEmPalavras(parcela.vencimento, hojeIso)}`
      : parcela.situacao === SITUACAO.HOJE
        ? 'vence hoje'
        : distanciaEmPalavras(parcela.vencimento, hojeIso);

  // Parcela paga não é botão: desfazer um recebimento é um ato do histórico de
  // pagamentos, onde se vê exatamente qual lançamento está sendo removido.
  const etiqueta = paga ? 'div' : 'button';
  const gatilho = paga ? '' : ` data-acao="pagar" data-divida="${esc(dividaId)}" data-parcela="${parcela.numero}"`;

  return `<${etiqueta} class="parcela ${classes(paga && 'paga', atrasada && 'atrasada')}"${gatilho}>
    <span class="parcela-numero">${parcela.numero}</span>
    <span class="parcela-info">
      <span>${esc(formatarDataCurta(parcela.vencimento))}</span>
      <span class="parcela-sub ${atrasada ? 'tom-atraso' : ''}">${esc(sub)}${
        parcela.parcial ? ` · falta ${esc(formatarReais(parcela.restanteCents))}` : ''}</span>
    </span>
    <span class="cifra cifra-peq parcela-valor">${esc(formatarReais(parcela.valorCents))}</span>
  </${etiqueta}>`;
}

/** Os números da dívida, como extrato. */
export function fatosDaDivida(estado) {
  return `<dl class="extrato">
    ${linhaExtrato('Valor original', formatarReais(estado.baseCents))}
    ${linhaExtrato('Juros', `${formatarPercentual(estado.jurosPercentual)} · ${formatarReais(estado.jurosCents)}`)}
    ${linhaExtrato('Valor total', formatarReais(estado.totalCents))}
    ${linhaExtrato('Recebido', formatarReais(estado.aplicadoCents))}
    ${linhaExtrato('Parcelas', `${estado.contagem.pagas} pagas · ${estado.contagem.pendentes} pendentes${
      estado.contagem.atrasadas > 0 ? ` · ${estado.contagem.atrasadas} atrasadas` : ''}`)}
    ${linhaExtrato('Próximo vencimento', estado.proximoVencimento ? formatarDataCurta(estado.proximoVencimento) : '—')}
  </dl>`;
}
