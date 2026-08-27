// CAIXA — de onde vem e para onde vai o dinheiro da operação.
//
// O saldo é um acumulado simples, e a tela mostra a conta inteira em vez de
// pedir fé: aportes menos retiradas, menos o emprestado, mais o recebido. O
// extrato abaixo é essa mesma conta, item a item.

import { esc, cabecalhoSecao, estadoVazio, avisar, tremer } from '../dom.js';
import { abrirFolha, fecharFolha, confirmar } from '../sheet.js';
import { linhaExtrato } from '../pieces.js';
import { formatarReais, lerValor } from '../../core/money.js';
import { formatarData, formatarDataCurta, comparar, hoje as dataDeHoje } from '../../core/dates.js';
import { TIPO_CAIXA } from '../../core/portfolio.js';

const LIMITE_EXTRATO = 30;

export function telaCaixa(ctx) {
  const pano = ctx.pano;
  const movimentos = montarExtrato(ctx);
  const visiveis = movimentos.slice(0, LIMITE_EXTRATO);

  return {
    titulo: 'Caixa',
    html: `
      <div class="destaque">
        <span class="etiqueta">Em caixa</span>
        <span class="cifra cifra-heroi ${pano.emCaixaCents < 0 ? 'tom-atraso' : ''}">${esc(formatarReais(pano.emCaixaCents))}</span>
      </div>

      <dl class="extrato">
        ${linhaExtrato('Aportes', formatarReais(pano.aportesCents))}
        ${linhaExtrato('Retiradas', formatarReais(pano.retiradasCents))}
        ${linhaExtrato('Emprestado', formatarReais(pano.emprestadoCents))}
        ${linhaExtrato('Recebido', formatarReais(pano.recebidoCents))}
      </dl>

      <p class="nota">
        Aportes − retiradas − emprestado + recebido. O que está com os clientes
        aparece em <b style="font-weight:600">Na rua</b>, no Início.
      </p>

      <div class="acoes">
        <button class="acao" data-acao="novo-aporte">Registrar aporte</button>
        <button class="acao" data-acao="nova-retirada">Registrar retirada</button>
      </div>

      ${pano.emCaixaCents < 0 && pano.aportesCents === 0 ? `<p class="nota" style="margin-top:20px">
        O caixa está negativo porque há capital emprestado sem origem registrada.
        Se esse dinheiro já era da operação, registre um aporte com o valor inicial.
      </p>` : ''}

      <section class="secao">
        ${cabecalhoSecao('Extrato', movimentos.length > 0 ? `${movimentos.length} lançamentos` : null)}
        ${visiveis.length === 0
          ? estadoVazio({
              titulo: 'Nenhum lançamento ainda.',
              texto: 'Empréstimos, recebimentos, aportes e retiradas aparecem aqui em ordem de data.',
            })
          : `<div class="itens">${visiveis.map(linhaMovimento).join('')}</div>`}
        ${movimentos.length > visiveis.length
          ? `<span class="mais">mostrando os ${visiveis.length} mais recentes</span>` : ''}
      </section>

      <div class="acoes" style="margin-top:44px">
        ${ctx.dados.exemplo
          ? '<button class="acao acao-fraca" data-acao="limpar-exemplo">Limpar dados de exemplo</button>'
          : '<button class="acao acao-fraca" data-acao="carregar-exemplo">Ver com dados de exemplo</button>'}
      </div>
    `,
  };
}

/**
 * O extrato une o que foi lançado à mão (aportes e retiradas) com o que é
 * consequência de outra coisa (empréstimos e recebimentos). Os dois últimos
 * não são gravados como movimento: são derivados das dívidas e dos pagamentos,
 * o que garante que o extrato jamais discorde do saldo.
 */
function montarExtrato(ctx) {
  const nome = id => {
    const c = ctx.store.cliente(id);
    return c ? c.nome : 'Cliente removido';
  };

  const movimentos = [
    ...ctx.dados.caixa.map(m => ({
      id: m.id,
      removivel: true,
      data: m.data,
      criadoEm: m.criadoEm,
      valorCents: m.tipo === TIPO_CAIXA.APORTE ? m.valorCents : -m.valorCents,
      titulo: m.tipo === TIPO_CAIXA.APORTE ? 'Aporte' : 'Retirada',
      sub: m.observacao || formatarData(m.data),
    })),
    ...ctx.dados.dividas.map(d => ({
      id: d.id,
      removivel: false,
      data: d.data,
      criadoEm: d.criadoEm,
      valorCents: -d.baseCents,
      titulo: 'Empréstimo',
      sub: nome(d.clienteId),
    })),
    ...ctx.dados.pagamentos.map(p => {
      const divida = ctx.store.divida(p.dividaId);
      return {
        id: p.id,
        removivel: false,
        data: p.data,
        criadoEm: p.criadoEm,
        valorCents: p.valorCents,
        titulo: 'Recebimento',
        sub: divida ? nome(divida.clienteId) : 'Cliente removido',
      };
    }),
  ];

  return movimentos.sort((a, b) => comparar(b.data, a.data) || (b.criadoEm - a.criadoEm));
}

function linhaMovimento(m) {
  const positivo = m.valorCents > 0;
  const conteudo = `
    <span class="item-corpo">
      <span class="item-nome" style="font-weight:450">${esc(m.titulo)}</span>
      <span class="item-sub">${esc(m.sub)}</span>
    </span>
    <span class="item-fim">
      <span class="cifra cifra-media ${positivo ? 'tom-recebido' : ''}">${
        positivo ? '+ ' : '− '}${esc(formatarReais(Math.abs(m.valorCents)))}</span>
      <span class="item-sub">${esc(formatarDataCurta(m.data))}</span>
    </span>`;

  return m.removivel
    ? `<button class="item" data-acao="ver-movimento" data-movimento="${esc(m.id)}">${conteudo}</button>`
    : `<div class="item">${conteudo}</div>`;
}

// ── ações da tela ─────────────────────────────────────────────────────────

export const acoesCaixa = {
  'novo-aporte'(alvo, ctx) { abrirMovimento(ctx, TIPO_CAIXA.APORTE); },
  'nova-retirada'(alvo, ctx) { abrirMovimento(ctx, TIPO_CAIXA.RETIRADA); },

  'ver-movimento'(alvo, ctx) {
    const movimento = ctx.dados.caixa.find(m => m.id === alvo.dataset.movimento);
    if (!movimento) return;
    const aporte = movimento.tipo === TIPO_CAIXA.APORTE;

    confirmar({
      titulo: `${aporte ? 'Aporte' : 'Retirada'} de ${formatarReais(movimento.valorCents)}`,
      texto: `${formatarData(movimento.data)}${movimento.observacao ? ` · ${movimento.observacao}` : ''}. ` +
             'Remover este lançamento recalcula o saldo em caixa.',
      rotuloConfirmar: 'Remover lançamento',
      perigo: true,
      aoConfirmar() {
        ctx.store.removerMovimentoCaixa(movimento.id);
        avisar('Lançamento removido.');
        ctx.atualizar();
      },
    });
  },
};

function abrirMovimento(ctx, tipo) {
  const aporte = tipo === TIPO_CAIXA.APORTE;

  abrirFolha({
    titulo: aporte ? 'Registrar aporte' : 'Registrar retirada',
    texto: aporte
      ? 'Dinheiro que entra no caixa da operação — capital próprio dos sócios.'
      : 'Dinheiro que sai do caixa e não é empréstimo — retirada de lucro, por exemplo.',
    conteudo: `
      <div class="campo">
        <label class="etiqueta" for="cx-valor">Valor</label>
        <div class="entrada-dinheiro">
          <span>R$</span>
          <input id="cx-valor" inputmode="decimal" autocomplete="off" placeholder="0,00">
        </div>
      </div>
      <div class="campo">
        <label class="etiqueta" for="cx-data">Data</label>
        <input class="entrada" id="cx-data" type="date" value="${esc(ctx.hoje)}" max="2100-12-31">
      </div>
      <div class="campo">
        <label class="etiqueta" for="cx-obs">Observação</label>
        <input class="entrada" id="cx-obs" placeholder="Opcional">
      </div>
      <div class="folha-acoes">
        <button class="botao botao-primario botao-bloco" id="cx-salvar">
          ${aporte ? 'Registrar aporte' : 'Registrar retirada'}</button>
        <button class="botao botao-bloco" id="cx-cancelar">Cancelar</button>
      </div>
    `,
    montar(folha) {
      folha.querySelector('#cx-cancelar').addEventListener('click', fecharFolha);
      folha.querySelector('#cx-salvar').addEventListener('click', () => {
        const valorCents = lerValor(folha.querySelector('#cx-valor').value);
        if (!valorCents || valorCents <= 0) {
          avisar('Informe um valor maior que zero.');
          return;
        }
        try {
          ctx.store.registrarMovimentoCaixa({
            tipo,
            valorCents,
            data: folha.querySelector('#cx-data').value || dataDeHoje(),
            observacao: folha.querySelector('#cx-obs').value,
          });
          fecharFolha();
          tremer();
          avisar(`${aporte ? 'Aporte' : 'Retirada'} de ${formatarReais(valorCents)} registrado.`);
          ctx.atualizar();
        } catch (erro) {
          avisar(erro.message);
        }
      });
    },
  });
}
