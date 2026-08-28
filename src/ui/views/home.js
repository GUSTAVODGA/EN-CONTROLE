// INÍCIO — o painel de cobrança do dia.
//
// A tela responde a uma pergunta só: QUEM eu preciso cobrar agora? Por isso a
// lista principal é de CLIENTES, não de parcelas. Um cliente com quatro
// parcelas vencidas é uma ligação, não quatro — e mostrá-lo quatro vezes só
// enche a tela sem acrescentar informação.
//
// A ordem é: quanto tenho, quanto está na rua, quem devo cobrar, o que vem
// depois. Nada mais cabe aqui.

import { cabecalhoSecao, estadoVazio } from '../dom.js';
import { blocoResumoCaixa, blocoCobranca, linhaAgenda } from '../pieces.js';
import { agruparPorCliente } from '../../core/portfolio.js';
import { formatarReais } from '../../core/money.js';

export function telaInicio(ctx) {
  return {
    titulo: 'EN Controle',
    html: ctx.dados.clientes.length === 0 ? primeiraVez() : conteudo(ctx),
  };
}

function conteudo(ctx) {
  const pano = ctx.pano;

  // Atrasado e vencendo hoje são a mesma tarefa — cobrar agora — e por isso
  // moram na mesma lista, em vez de em duas seções que competem pela atenção.
  const paraCobrar = agruparPorCliente([...pano.agenda.atrasadas, ...pano.agenda.hoje]);
  const totalACobrar = pano.atrasadoCents + pano.venceHojeCents;
  const proximas = pano.agenda.proximas;

  return `
    ${ctx.dados.exemplo ? avisoExemplo() : ''}

    ${blocoResumoCaixa(pano)}

    ${paraCobrar.length > 0 ? `<section class="secao">
      ${cabecalhoSecao('Cobrar agora', formatarReais(totalACobrar))}
      ${paraCobrar.slice(0, 4).map(g => blocoCobranca(g, ctx.hoje)).join('')}
      ${paraCobrar.length > 4 ? `<span class="mais">e mais ${paraCobrar.length - 4} clientes</span>` : ''}
    </section>` : `<section class="secao">
      ${cabecalhoSecao('Cobrar agora')}
      ${estadoVazio({
        titulo: 'Nada a cobrar hoje.',
        texto: 'Nenhuma parcela venceu ou vence hoje. O que vem a seguir está logo abaixo.',
      })}
    </section>`}

    ${proximas.length > 0 ? `<section class="secao">
      ${cabecalhoSecao('A vencer', `${proximas.length}`)}
      <div class="itens">${proximas.slice(0, 4).map(i => linhaAgenda(i, ctx.hoje)).join('')}</div>
      ${proximas.length > 4 ? `<span class="mais">e mais ${proximas.length - 4} parcelas</span>` : ''}
    </section>` : ''}

    <div class="acoes acoes-duplas" style="margin-top:28px">
      <button class="botao botao-primario" data-acao="nova-divida">Nova dívida</button>
      <button class="botao" data-acao="novo-cliente">Novo cliente</button>
    </div>
  `;
}

function primeiraVez() {
  return `
    ${estadoVazio({
      titulo: 'Comece cadastrando um cliente.',
      texto: 'Depois é só registrar a dívida: valor, juros, periodicidade e a data da primeira parcela. O restante o sistema calcula.',
      botao: { acao: 'novo-cliente', rotulo: 'Cadastrar cliente' },
    })}
    <p class="nota" style="max-width:36ch">
      Já tem dinheiro na rua? Registre um aporte em Caixa para o saldo refletir
      o capital da operação.
    </p>
  `;
}

function avisoExemplo() {
  return `<div style="display:flex;align-items:center;gap:12px;margin:0 0 16px">
    <span class="etiqueta">Dados de exemplo</span>
    <button class="botao botao-baixo" data-acao="limpar-exemplo">Limpar</button>
  </div>`;
}
