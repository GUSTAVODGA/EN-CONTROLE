// FICHA DO CLIENTE — os dados dele, as dívidas e o histórico de pagamentos.
//
// Um cliente pode ter várias dívidas ao mesmo tempo, e cada uma aparece
// inteira. Para que "inteira" não vire "amontoada", cada dívida mostra por
// padrão só o essencial — saldo, termos e situação — e abre o resto sob toque.

import { esc, cabecalhoSecao, estadoVazio } from '../dom.js';
import { icones } from '../icons.js';
import {
  trioDeValores, situacaoDaDivida, progressoDivida, termosDaDivida,
  fatosDaDivida, linhaParcela,
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
        { rotulo: 'Atrasado', cents: estado.atrasadoCents, tom: estado.atrasadoCents > 0 ? 'tom-atraso' : 'tom-fraco' },
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
        <button class="acao" data-acao="nova-divida">Nova dívida</button>
      </div>` : ''}

      ${pagamentos.length > 0 ? `<section class="secao">
        ${cabecalhoSecao('Pagamentos', `${formatarReais(estado.recebidoCents)} recebidos`)}
        <div class="itens">${pagamentos.map(linhaPagamento).join('')}</div>
      </section>` : ''}

      <div class="acoes" style="margin-top:44px">
        <button class="acao acao-perigo" data-acao="excluir-cliente">Excluir cliente</button>
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
    return `<p class="nota" style="margin-top:18px">
      Sem telefone, endereço ou observações.
      <button class="acao acao-fraca" style="border-bottom:1px solid var(--linha)" data-acao="editar-cliente">Adicionar</button>
    </p>`;
  }

  return `<div style="margin-top:18px">${partes.map(p => `
    <p class="rotulo" style="margin:0 0 4px;color:var(--tinta-2);line-height:1.55">${
      p.link ? `<a href="${esc(p.link)}" style="color:inherit;text-decoration:none">${esc(p.texto)}</a>` : esc(p.texto)
    }</p>`).join('')}</div>`;
}

function blocoDivida(estado, ctx) {
  const aberta = dividasAbertas.has(estado.dividaId);
  const situacao = situacaoDaDivida(estado);

  return `<section style="padding:22px 0 4px;border-top:1px solid var(--linha-fina)">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:14px">
      <span class="cifra cifra-grande">${esc(formatarReais(estado.saldoCents))}</span>
      <span class="item-sub ${situacao.tom}" style="margin:0">${esc(situacao.texto)}</span>
    </div>
    <p class="rotulo" style="margin:5px 0 0">
      ${estado.quitada ? 'dívida quitada' : 'saldo restante'} · ${esc(termosDaDivida(estado))}
    </p>
    <div style="margin-top:16px">${progressoDivida(estado)}</div>

    <div class="acoes" style="margin-top:18px">
      ${!estado.quitada ? `<button class="acao" data-acao="pagar"
        data-divida="${esc(estado.dividaId)}" data-parcela="${estado.proximaParcela.numero}">
        Registrar pagamento</button>` : ''}
      <button class="acao acao-fraca" data-acao="alternar-divida" data-divida="${esc(estado.dividaId)}">
        ${aberta ? 'Menos detalhes' : 'Ver detalhes'}
      </button>
    </div>

    ${aberta ? `
      ${fatosDaDivida(estado)}
      <div class="secao" style="margin-top:26px">
        ${cabecalhoSecao('Parcelas')}
        <div>${estado.parcelas.map(p => linhaParcela(p, estado.dividaId, ctx.hoje)).join('')}</div>
      </div>
      <div class="acoes">
        <button class="acao acao-perigo" data-acao="excluir-divida" data-divida="${esc(estado.dividaId)}">
          Excluir dívida</button>
      </div>
    ` : ''}
  </section>`;
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
      <span class="item-nome" style="font-weight:450">${esc(formatarData(pagamento.data))}</span>
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
