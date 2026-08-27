// FICHA DO CLIENTE — os dados dele, as dívidas e o histórico de pagamentos.
//
// Um cliente pode ter várias dívidas ao mesmo tempo, e cada uma é um bloco
// fechado por traço. Para que "várias" não vire "amontoado", cada bloco mostra
// por padrão só saldo, termos e situação; o resto abre sob toque.

import { esc, cabecalhoSecao, estadoVazio } from '../dom.js';
import { icones } from '../icons.js';
import {
  trioDeValores, situacaoDaDivida, termosDaDivida, fatosDaDivida, linhaParcela,
} from '../pieces.js';
import { formatarReais } from '../../core/money.js';
import { formatarData, formatarDataCurta, comparar } from '../../core/dates.js';
import { estadoDoCliente } from '../../core/portfolio.js';
import { formatarTelefone } from '../../core/model.js';

// Quais dívidas estão abertas na tela. Estado de tela, não de dado.
const dividasAbertas = new Set();

export function telaCliente(ctx) {
  const cliente = ctx.store.cliente(ctx.params.id);
  if (!cliente) {
    return {
      titulo: 'Cliente',
      voltar: true,
      html: estadoVazio({
        titulo: 'Cliente não encontrado.',
        texto: 'Ele pode ter sido removido neste aparelho.',
        botao: { acao: 'ir-clientes', rotulo: 'Ver clientes' },
      }),
    };
  }

  const estado = estadoDoCliente(cliente, ctx.pano);
  const dividas = [...estado.dividas].sort(ordenarDividas);
  const pagamentos = historicoDoCliente(ctx, dividas);

  return {
    titulo: cliente.nome,
    tituloEmDestaque: true,
    voltar: true,
    acaoTopo: { acao: 'editar-cliente', icone: icones.lapis, rotulo: 'Editar cliente' },
    html: `
      ${contato(cliente)}

      ${estado.contagem.dividas > 0 ? trioDeValores([
        { rotulo: 'A receber', cents: estado.aReceberCents },
        { rotulo: 'Na rua', cents: estado.naRuaCents },
        { rotulo: 'Atrasado', cents: estado.atrasadoCents, tom: estado.atrasadoCents > 0 ? 'tom-atraso' : '' },
      ]) : ''}

      <section class="secao">
        ${cabecalhoSecao('Dívidas', dividas.length > 0 ? `${estado.contagem.abertas} em aberto` : null)}
        ${dividas.length === 0
          ? estadoVazio({
              titulo: 'Nenhuma dívida registrada.',
              texto: 'Cadastre a primeira dívida deste cliente.',
              botao: { acao: 'nova-divida', rotulo: 'Nova dívida' },
            })
          : dividas.map(d => blocoDivida(d, ctx)).join('')}
      </section>

      ${dividas.length > 0 ? `<div class="acoes">
        <button class="botao" data-acao="nova-divida">Nova dívida</button>
      </div>` : ''}

      ${pagamentos.length > 0 ? `<section class="secao">
        ${cabecalhoSecao('Pagamentos', `${formatarReais(estado.recebidoCents)} recebidos`)}
        <div class="itens">${pagamentos.map(linhaPagamento).join('')}</div>
      </section>` : ''}

      <div class="acoes" style="margin-top:36px">
        <button class="botao botao-perigo botao-baixo" data-acao="excluir-cliente">Excluir cliente</button>
      </div>
    `,
  };
}

function ordenarDividas(a, b) {
  if (a.quitada !== b.quitada) return a.quitada ? 1 : -1;
  if (a.emAtraso !== b.emAtraso) return a.emAtraso ? -1 : 1;
  if (a.proximoVencimento && b.proximoVencimento) return comparar(a.proximoVencimento, b.proximoVencimento);
  return 0;
}

function contato(cliente) {
  const partes = [
    cliente.telefone && { texto: formatarTelefone(cliente.telefone), link: `tel:${cliente.telefone.replace(/\D/g, '')}` },
    cliente.endereco && { texto: cliente.endereco },
    cliente.observacoes && { texto: cliente.observacoes },
  ].filter(Boolean);

  if (partes.length === 0) {
    return `<div class="acoes" style="margin-top:0">
      <button class="botao botao-baixo" data-acao="editar-cliente">Adicionar telefone e endereço</button>
    </div>`;
  }

  return `<div class="bloco" style="padding:13px 15px">${partes.map((p, i) => `
    <p class="legenda" style="margin:${i === 0 ? '0' : '6px 0 0'}">${
      p.link ? `<a href="${esc(p.link)}" style="color:inherit;font-weight:700;text-decoration:none">${esc(p.texto)}</a>` : esc(p.texto)
    }</p>`).join('')}</div>`;
}

function blocoDivida(estado, ctx) {
  const aberta = dividasAbertas.has(estado.dividaId);
  const situacao = situacaoDaDivida(estado);

  return `<div class="bloco" style="margin-bottom:8px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px">
      <span class="etiqueta">${estado.quitada ? 'Quitada' : 'Saldo restante'}</span>
      <span class="etiqueta ${situacao.tom}">${esc(situacao.texto)}</span>
    </div>
    <div class="cifra cifra-grande" style="margin-top:6px">${esc(formatarReais(estado.saldoCents))}</div>
    <p class="legenda" style="margin:5px 0 0">${esc(termosDaDivida(estado))}</p>

    <div class="acoes ${estado.quitada ? '' : 'acoes-duplas'}" style="margin-top:14px">
      ${!estado.quitada ? `<button class="botao botao-primario botao-baixo" data-acao="pagar"
        data-divida="${esc(estado.dividaId)}" data-parcela="${estado.proximaParcela.numero}">
        Receber</button>` : ''}
      <button class="botao botao-baixo" data-acao="alternar-divida" data-divida="${esc(estado.dividaId)}">
        ${aberta ? 'Fechar' : 'Detalhes'}
      </button>
    </div>

    ${aberta ? `
      ${fatosDaDivida(estado)}
      <div class="secao" style="margin-top:22px">
        ${cabecalhoSecao('Parcelas')}
        <div class="itens">${estado.parcelas.map(p => linhaParcela(p, estado.dividaId, ctx.hoje)).join('')}</div>
      </div>
      <div class="acoes" style="margin-top:16px">
        <button class="botao botao-perigo botao-baixo" data-acao="excluir-divida" data-divida="${esc(estado.dividaId)}">
          Excluir dívida</button>
      </div>
    ` : ''}
  </div>`;
}

function historicoDoCliente(ctx, dividas) {
  const ids = new Set(dividas.map(d => d.dividaId));
  const porId = new Map(dividas.map(d => [d.dividaId, d]));

  return ctx.dados.pagamentos
    .filter(p => ids.has(p.dividaId))
    .map(p => ({ ...p, divida: porId.get(p.dividaId) }))
    .sort((a, b) => comparar(b.data, a.data) || (b.criadoEm - a.criadoEm));
}

function linhaPagamento(pagamento) {
  const descricao = pagamento.parcelaNumero
    ? `parcela ${pagamento.parcelaNumero} de ${pagamento.divida.contagem.total}`
    : 'pagamento avulso';

  return `<button class="item" data-acao="ver-pagamento" data-pagamento="${esc(pagamento.id)}">
    <span class="item-corpo">
      <span class="item-nome">${esc(formatarData(pagamento.data))}</span>
      <span class="item-sub">${esc(descricao)} · dívida de ${esc(formatarReais(pagamento.divida.baseCents))}</span>
    </span>
    <span class="item-fim">
      <span class="cifra cifra-media tom-recebido">${esc(formatarReais(pagamento.valorCents))}</span>
      <span class="item-sub">${esc(formatarDataCurta(pagamento.data))}</span>
    </span>
  </button>`;
}

/** Abre ou fecha os detalhes de uma dívida. */
export function alternarDivida(dividaId) {
  if (dividasAbertas.has(dividaId)) dividasAbertas.delete(dividaId);
  else dividasAbertas.add(dividaId);
}
