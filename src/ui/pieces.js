// Peças visuais compartilhadas.
//
// Duas regras valem para todas. Composição: o número fica à direita e é a
// coisa mais pesada da linha; o que explica o número fica à esquerda, menor.
// Tipografia: serifa (Fraunces) é só para o valor em caixa e para nomes de
// pessoa — o resto é sempre Manrope em negrito. É o que dá à serifa o peso de
// "isto importa" em vez de virar papel de parede.

import { esc, classes } from './dom.js';
import { formatarReais, formatarPercentual } from '../core/money.js';
import { formatarDataCurta, distanciaEmPalavras } from '../core/dates.js';
import { SITUACAO } from '../core/debt.js';
import { rotuloPeriodicidade } from '../core/schedule.js';

/**
 * O bloco âncora do Início: o único bloco de cor da tela, com o único número
 * em serifa. Os três números de apoio moram dentro dele, separados por um
 * fio — é a mesma peça, não um cartão hero mais uma régua solta embaixo.
 */
export function blocoResumoCaixa(pano) {
  return `<div class="bloco-forte">
    <span class="etiqueta">Em caixa</span>
    <span class="cifra-heroi">${esc(formatarReais(pano.emCaixaCents))}</span>
    <div class="resumo-linhas">
      ${colunaResumo('Na rua', pano.naRuaCents)}
      ${colunaResumo('A receber', pano.aReceberCents)}
      ${colunaResumo('Atrasado', pano.atrasadoCents, pano.atrasadoCents > 0 ? 'tom-atraso' : '')}
    </div>
  </div>`;
}

function colunaResumo(rotulo, cents, tom = '') {
  return `<div class="resumo-col">
    <span class="etiqueta">${esc(rotulo)}</span>
    <span class="cifra cifra-media ${tom}">${esc(formatarReais(cents))}</span>
  </div>`;
}

function itemTrinca(rotulo, cents, tom = '') {
  return `<div class="trinca-item">
    <span class="etiqueta">${esc(rotulo)}</span>
    <span class="cifra ${tom}">${esc(formatarReais(cents))}</span>
  </div>`;
}

/**
 * Um cliente a cobrar. É a peça central do Início: uma linha por PESSOA, com
 * tudo o que ela deve agora somado, porque é assim que a cobrança acontece.
 */
export function blocoCobranca(grupo, hojeIso) {
  const atrasado = grupo.diasDeAtrasoMax > 0;
  const parcelas = `${grupo.quantidade} ${grupo.quantidade === 1 ? 'parcela' : 'parcelas'}`;
  const quando = atrasado
    ? `${grupo.diasDeAtrasoMax} ${grupo.diasDeAtrasoMax === 1 ? 'dia' : 'dias'} de atraso`
    : 'vence hoje';

  return `<button class="cobranca ${atrasado ? 'urgente' : ''}"
      data-acao="abrir-cliente" data-cliente="${esc(grupo.clienteId)}">
    <span class="cobranca-topo">
      <span class="cobranca-nome">${esc(grupo.clienteNome)}</span>
      <span class="cifra cifra-media ${atrasado ? 'tom-atraso' : ''}">${esc(formatarReais(grupo.totalCents))}</span>
    </span>
    <span class="cobranca-sub">${esc(parcelas)} · ${esc(quando)}</span>
  </button>`;
}

/** Uma parcela futura, na lista do "a vencer". */
export function linhaAgenda(item, hojeIso) {
  return `<button class="item" data-acao="pagar" data-divida="${esc(item.dividaId)}" data-parcela="${item.numero}">
    <span class="item-corpo">
      <span class="item-nome nome-pessoa">${esc(item.clienteNome)}</span>
      <span class="item-sub">parcela ${item.numero} de ${item.totalParcelas}${item.parcial ? ' · parcial' : ''}</span>
    </span>
    <span class="item-fim">
      <span class="cifra cifra-media">${esc(formatarReais(item.restanteCents))}</span>
      <span class="item-sub">${esc(formatarDataCurta(item.vencimento))} · ${esc(distanciaEmPalavras(item.vencimento, hojeIso))}</span>
    </span>
  </button>`;
}

/**
 * Uma linha de extrato: rótulo à esquerda, quantia à direita.
 *
 * @param {boolean} livre  o valor é uma descrição, não uma quantia — pode
 *   quebrar em mais de uma linha, em vez de forçar nowrap como todo .cifra.
 */
export function linhaExtrato(rotulo, valor, tom = '', livre = false) {
  return `<div class="extrato-linha">
    <dt class="extrato-rotulo">${esc(rotulo)}</dt>
    <dd class="${livre ? 'livre' : 'cifra cifra-peq'} ${tom}">${esc(valor)}</dd>
  </div>`;
}

/** Trinca de valores para a ficha do cliente. */
export function trioDeValores(itens) {
  return `<div class="trinca">${
    itens.map(i => itemTrinca(i.rotulo, i.cents, i.tom || '')).join('')
  }</div>`;
}

/** Situação do cliente em palavra. */
export function situacaoDoCliente(estado) {
  if (estado.situacao === 'atrasado') {
    const n = estado.contagem.parcelasAtrasadas;
    return { texto: `${n} ${n === 1 ? 'atrasada' : 'atrasadas'}`, tom: 'tom-atraso' };
  }
  if (estado.situacao === 'quitado') return { texto: 'quitado', tom: 'tom-fraco' };
  if (estado.situacao === 'sem-dividas') return { texto: 'sem dívidas', tom: 'tom-fraco' };
  const n = estado.contagem.abertas;
  return { texto: `${n} ${n === 1 ? 'dívida' : 'dívidas'}`, tom: 'tom-fraco' };
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

/** Os termos combinados, em uma linha. */
export function termosDaDivida(estado) {
  return `${formatarReais(estado.baseCents)} + ${formatarPercentual(estado.jurosPercentual)} · ` +
    `${rotuloPeriodicidade(estado.periodicidade).toLowerCase()} · ${estado.contagem.total}×`;
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
      ${esc(formatarDataCurta(parcela.vencimento))}
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
      estado.contagem.atrasadas > 0 ? ` · ${estado.contagem.atrasadas} atrasadas` : ''}`, '', true)}
    ${linhaExtrato('Próximo vencimento', estado.proximoVencimento ? formatarDataCurta(estado.proximoVencimento) : '—')}
  </dl>`;
}
