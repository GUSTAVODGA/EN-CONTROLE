// INÍCIO — "como está a operação hoje?", respondido numa olhada.
//
// A tela é curta de propósito. Um valor grande, três linhas de extrato e, no
// máximo, três parcelas por seção. Tudo o que não cabe nesse resumo tem uma
// tela própria a um toque de distância — não precisa estar aqui.

import { esc, cabecalhoSecao, estadoVazio } from '../dom.js';
import { resumoFinanceiro, listaAgenda } from '../pieces.js';
import { formatarReais } from '../../core/money.js';
import { formatarDataExtenso, diaDaSemana } from '../../core/dates.js';

export function telaInicio(ctx) {
  return {
    titulo: 'EN Controle',
    html: ctx.dados.clientes.length === 0 ? primeiraVez() : conteudo(ctx),
  };
}

function conteudo(ctx) {
  const pano = ctx.pano;
  const { atrasadas, hoje: vencendoHoje, proximas } = pano.agenda;
  const nada = atrasadas.length === 0 && vencendoHoje.length === 0 && proximas.length === 0;

  return `
    ${ctx.dados.exemplo ? avisoExemplo() : ''}

    <p class="rotulo" style="margin:0">
      ${esc(capitalizar(diaDaSemana(ctx.hoje)))}, ${esc(formatarDataExtenso(ctx.hoje))}
    </p>

    ${resumoFinanceiro(pano)}

    ${vencendoHoje.length > 0 ? `<section class="secao">
      ${cabecalhoSecao('Vence hoje', formatarReais(pano.venceHojeCents))}
      ${listaAgenda(vencendoHoje, ctx.hoje)}
    </section>` : ''}

    ${atrasadas.length > 0 ? `<section class="secao">
      ${cabecalhoSecao('Em atraso', formatarReais(pano.atrasadoCents))}
      ${listaAgenda(atrasadas, ctx.hoje)}
    </section>` : ''}

    ${proximas.length > 0 ? `<section class="secao">
      ${cabecalhoSecao('A vencer')}
      ${listaAgenda(proximas, ctx.hoje)}
    </section>` : ''}

    ${nada ? `<section class="secao">${estadoVazio({
      titulo: 'Nenhuma parcela em aberto.',
      texto: 'Tudo o que foi cadastrado está quitado.',
    })}</section>` : ''}

    <div class="acoes">
      <button class="acao" data-acao="nova-divida">Nova dívida</button>
      <button class="acao acao-fraca" data-acao="novo-cliente">Novo cliente</button>
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
    <p class="nota" style="max-width:34ch;margin-top:34px">
      Já tem dinheiro na rua? Registre um aporte em Caixa para o saldo refletir
      o capital da operação.
    </p>
  `;
}

function avisoExemplo() {
  return `<p class="nota" style="margin:0 0 2px">
    Dados de exemplo.
    <button class="acao acao-fraca" style="border-bottom:1px solid var(--linha)" data-acao="limpar-exemplo">Limpar</button>
  </p>`;
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
