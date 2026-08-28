// NOVA DÍVIDA — seis campos e uma prévia que não deixa dúvida.
//
// A prévia é recalculada a cada tecla pelo MESMO motor que vai gerar as
// parcelas depois de salvar. Não existe uma conta "de mostrar" e outra "de
// valer": o que aparece antes de salvar é literalmente o cronograma que será
// gravado.

import { esc, avisar, tremer } from '../dom.js';
import { icones } from '../icons.js';
import { abrirFolha, fecharFolha } from '../sheet.js';
import { abrirFormularioCliente } from '../client-form.js';
import { linhaExtrato } from '../pieces.js';
import { formatarReais, formatarPercentual, lerValor } from '../../core/money.js';
import { formatarData, hoje as dataDeHoje } from '../../core/dates.js';
import { montarCronograma, LISTA_PERIODICIDADES, JUROS_SUGERIDOS, MAX_PARCELAS } from '../../core/schedule.js';

const PARCELAS_SUGERIDAS = [4, 6, 10, 12];

let rascunho = null;

/** Começa um rascunho limpo. Chamado ao entrar na tela. */
export function prepararNovaDivida(clienteId = null) {
  rascunho = {
    clienteId,
    valorTexto: '',
    jurosPercentual: 20,
    jurosTexto: '',
    jurosLivre: false,
    periodicidade: 'mensal',
    parcelas: 10,
    primeiroVencimento: dataDeHoje(),
  };
}

function garantirRascunho() {
  if (!rascunho) prepararNovaDivida();
  return rascunho;
}

function jurosAtual() {
  const r = garantirRascunho();
  if (!r.jurosLivre) return r.jurosPercentual;
  const numero = Number(String(r.jurosTexto).replace(',', '.'));
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

/** Tenta montar o cronograma com o que já foi preenchido. */
function calcular() {
  const r = garantirRascunho();
  const baseCents = lerValor(r.valorTexto);
  const juros = jurosAtual();

  if (!baseCents || baseCents <= 0) return { pendente: 'Informe o valor da dívida.' };
  if (juros === null) return { pendente: 'Informe um percentual de juros válido.' };
  if (!r.parcelas || r.parcelas < 1) return { pendente: 'Informe a quantidade de parcelas.' };
  if (!r.primeiroVencimento) return { pendente: 'Escolha a data da primeira parcela.' };

  try {
    return {
      cronograma: montarCronograma({
        baseCents,
        jurosPercentual: juros,
        periodicidade: r.periodicidade,
        parcelas: r.parcelas,
        primeiroVencimento: r.primeiroVencimento,
      }),
    };
  } catch (erro) {
    return { erro: erro.message };
  }
}

export function telaNovaDivida(ctx) {
  const r = garantirRascunho();
  const cliente = r.clienteId ? ctx.store.cliente(r.clienteId) : null;
  if (r.clienteId && !cliente) r.clienteId = null;

  return {
    titulo: 'Nova dívida',
    voltar: true,
    semAbas: true,
    html: `
      <div class="campo">
        <span class="etiqueta">Cliente</span>
        <button class="seletor" data-acao="escolher-cliente">
          ${cliente
            ? `<span class="seletor-nome">${esc(cliente.nome)}</span>`
            : '<span class="seletor-vazio">Escolher cliente</span>'}
          <span class="tom-fraco" style="display:flex">${icones.direita}</span>
        </button>
      </div>

      <div class="campo">
        <label class="etiqueta" for="nd-valor">Valor base</label>
        <div class="entrada-dinheiro">
          <span>R$</span>
          <input id="nd-valor" inputmode="decimal" autocomplete="off" placeholder="0,00"
                 value="${esc(r.valorTexto)}">
        </div>
        <p class="campo-dica">O quanto sai do caixa agora, sem os juros.</p>
      </div>

      <div class="campo">
        <span class="etiqueta">Juros</span>
        <div class="opcoes">
          ${JUROS_SUGERIDOS.map(p => `<button class="opcao" data-acao="juros" data-valor="${p}"
            aria-pressed="${!r.jurosLivre && r.jurosPercentual === p}">${p}%</button>`).join('')}
          <button class="opcao" data-acao="juros-livre" aria-pressed="${r.jurosLivre}">Outro</button>
        </div>
        ${r.jurosLivre ? `<div style="margin-top:10px">
          <input class="entrada" id="nd-juros" inputmode="decimal" autocomplete="off"
                 placeholder="Percentual, ex.: 12,5" value="${esc(r.jurosTexto)}">
        </div>` : ''}
      </div>

      <div class="campo">
        <span class="etiqueta">Periodicidade</span>
        <div class="opcoes">
          ${LISTA_PERIODICIDADES.map(p => `<button class="opcao" data-acao="periodicidade" data-valor="${esc(p.id)}"
            aria-pressed="${r.periodicidade === p.id}">${esc(p.rotulo)}</button>`).join('')}
        </div>
        <p class="campo-dica">${esc(descricaoPeriodicidade(r.periodicidade))}</p>
      </div>

      <div class="campo">
        <label class="etiqueta" for="nd-parcelas">Número de parcelas</label>
        <div class="passo">
          <button data-acao="parcelas-menos" aria-label="Menos uma parcela">${icones.menos}</button>
          <input id="nd-parcelas" type="number" inputmode="numeric" min="1" max="${MAX_PARCELAS}" value="${r.parcelas}">
          <button data-acao="parcelas-mais" aria-label="Mais uma parcela">${icones.mais}</button>
        </div>
        <div class="opcoes" style="margin-top:10px">
          ${PARCELAS_SUGERIDAS.map(n => `<button class="opcao" data-acao="parcelas" data-valor="${n}"
            aria-pressed="${r.parcelas === n}">${n}×</button>`).join('')}
        </div>
      </div>

      <div class="campo">
        <label class="etiqueta" for="nd-data">Data da primeira parcela</label>
        <input class="entrada" id="nd-data" type="date" value="${esc(r.primeiroVencimento)}" max="2100-12-31">
      </div>

      <div class="secao" id="nd-previa">${previa()}</div>

      <div class="rodape-acao"><div class="rodape-acao-interno">
        <button class="botao botao-primario botao-bloco" data-acao="salvar-divida">Salvar dívida</button>
      </div></div>
    `,
    aoMontar(raiz) {
      const valor = raiz.querySelector('#nd-valor');
      const juros = raiz.querySelector('#nd-juros');
      const parcelas = raiz.querySelector('#nd-parcelas');
      const data = raiz.querySelector('#nd-data');

      // Digitar redesenha só a prévia: redesenhar a tela inteira perderia o
      // cursor no meio do número.
      valor.addEventListener('input', () => { rascunho.valorTexto = valor.value; redesenharPrevia(raiz); });
      if (juros) juros.addEventListener('input', () => { rascunho.jurosTexto = juros.value; redesenharPrevia(raiz); });
      parcelas.addEventListener('input', () => {
        const bruto = Number(parcelas.value) || 1;
        const n = Math.max(1, Math.min(MAX_PARCELAS, bruto));
        // Só corrige o campo quando o valor digitado extrapola o limite — do
        // contrário, corrigir a cada tecla atrapalharia quem está no meio de
        // digitar um número de dois ou três dígitos ainda válido.
        if (bruto > MAX_PARCELAS) parcelas.value = String(n);
        rascunho.parcelas = n;
        redesenharPrevia(raiz);
      });
      data.addEventListener('change', () => { rascunho.primeiroVencimento = data.value; redesenharPrevia(raiz); });
    },
  };
}

function descricaoPeriodicidade(id) {
  const p = LISTA_PERIODICIDADES.find(x => x.id === id);
  if (!p) return '';
  return id === 'mensal'
    ? 'Avança mês de calendário; quando o dia não existe, cai no último do mês.'
    : `Vencimentos ${p.descricao}, sempre em intervalos iguais.`;
}

function redesenharPrevia(raiz) {
  const alvo = raiz.querySelector('#nd-previa');
  if (alvo) alvo.innerHTML = previa();
}

function previa() {
  const resultado = calcular();

  if (resultado.pendente) {
    return `<div class="previa"><p class="previa-aviso">${esc(resultado.pendente)}</p></div>`;
  }
  if (resultado.erro) {
    return `<div class="previa"><p class="previa-aviso previa-erro">${esc(resultado.erro)}</p></div>`;
  }

  const c = resultado.cronograma;
  const descricaoParcelas = c.parcelasIguais
    ? `${c.parcelas.length} × ${formatarReais(c.valorParcelaCents)}`
    : `${c.parcelas.length - 1} × ${formatarReais(c.valorParcelaCents)} + ${formatarReais(c.ultimaParcelaCents)}`;

  return `<div class="previa">
    <div class="previa-total">
      <span class="etiqueta">Total a receber</span>
      <span class="cifra cifra-grande">${esc(formatarReais(c.totalCents))}</span>
    </div>
    <dl class="extrato" style="margin-top:0">
      ${linhaExtrato('Valor', formatarReais(c.baseCents))}
      ${linhaExtrato('Juros', `${formatarPercentual(c.jurosPercentual)} · ${formatarReais(c.jurosCents)}`)}
      ${linhaExtrato('Total', formatarReais(c.totalCents))}
      ${linhaExtrato('Parcelas', descricaoParcelas, '', true)}
      ${linhaExtrato('Primeiro vencimento', formatarData(c.primeiroVencimento))}
      ${linhaExtrato('Último vencimento', formatarData(c.ultimoVencimento))}
    </dl>
  </div>`;
}

// ── ações da tela, chamadas pelo roteador ────────────────────────────────

export const acoesNovaDivida = {
  juros(alvo, ctx) {
    rascunho.jurosLivre = false;
    rascunho.jurosPercentual = Number(alvo.dataset.valor);
    ctx.atualizar();
  },

  'juros-livre'(alvo, ctx) {
    rascunho.jurosLivre = !rascunho.jurosLivre;
    if (rascunho.jurosLivre && !rascunho.jurosTexto) rascunho.jurosTexto = String(rascunho.jurosPercentual);
    ctx.atualizar({ manterFoco: rascunho.jurosLivre ? '#nd-juros' : null });
  },

  periodicidade(alvo, ctx) {
    rascunho.periodicidade = alvo.dataset.valor;
    ctx.atualizar();
  },

  parcelas(alvo, ctx) {
    rascunho.parcelas = Number(alvo.dataset.valor);
    ctx.atualizar();
  },

  'parcelas-mais'(alvo, ctx) {
    rascunho.parcelas = Math.min(MAX_PARCELAS, rascunho.parcelas + 1);
    ctx.atualizar();
  },

  'parcelas-menos'(alvo, ctx) {
    rascunho.parcelas = Math.max(1, rascunho.parcelas - 1);
    ctx.atualizar();
  },

  'escolher-cliente'(alvo, ctx) {
    abrirSeletorDeCliente(ctx);
  },

  'salvar-divida'(alvo, ctx) {
    const r = garantirRascunho();
    if (!r.clienteId) {
      avisar('Escolha o cliente da dívida.');
      return;
    }
    const resultado = calcular();
    if (resultado.pendente || resultado.erro) {
      avisar(resultado.pendente || resultado.erro);
      return;
    }
    try {
      const c = resultado.cronograma;
      ctx.store.adicionarDivida({
        clienteId: r.clienteId,
        baseCents: c.baseCents,
        jurosPercentual: c.jurosPercentual,
        periodicidade: c.periodicidade,
        parcelas: c.parcelas.length,
        primeiroVencimento: c.primeiroVencimento,
      });
      const clienteId = r.clienteId;
      rascunho = null;
      tremer();
      avisar(`Dívida de ${formatarReais(c.totalCents)} registrada.`);
      ctx.ir(`#/cliente/${clienteId}`, { substituir: true });
    } catch (erro) {
      avisar(erro.message);
    }
  },
};

function abrirSeletorDeCliente(ctx) {
  const clientes = [...ctx.dados.clientes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  abrirFolha({
    titulo: 'Escolher cliente',
    conteudo: `
      ${clientes.length > 3 ? `<div class="busca" style="margin-bottom:12px">
        ${icones.busca}
        <input class="entrada" id="sel-busca" type="search" placeholder="Buscar cliente" autocomplete="off">
      </div>` : ''}
      <div class="folha-lista" id="sel-lista">
        ${clientes.length === 0
          ? '<p class="folha-texto" style="padding:8px 18px">Nenhum cliente cadastrado ainda.</p>'
          : `<div class="itens">
              ${clientes.map(itemCliente).join('')}
             </div>`}
      </div>
      <div class="folha-acoes">
        <button class="botao botao-bloco" id="sel-novo">Cadastrar novo cliente</button>
      </div>
    `,
    montar(folha) {
      const busca = folha.querySelector('#sel-busca');
      if (busca) {
        busca.addEventListener('input', () => {
          const termo = busca.value.trim().toLowerCase();
          folha.querySelectorAll('[data-nome]').forEach(el => {
            el.hidden = termo ? !el.dataset.nome.includes(termo) : false;
          });
        });
      }

      folha.querySelectorAll('[data-escolher]').forEach(botao => {
        botao.addEventListener('click', () => {
          rascunho.clienteId = botao.dataset.escolher;
          fecharFolha();
          ctx.atualizar();
        });
      });

      folha.querySelector('#sel-novo').addEventListener('click', () => {
        fecharFolha();
        abrirFormularioCliente(ctx, null, cliente => {
          rascunho.clienteId = cliente.id;
          ctx.atualizar();
        });
      });
    },
  });
}

function itemCliente(cliente) {
  return `<button class="item" data-escolher="${esc(cliente.id)}" data-nome="${esc(cliente.nome.toLowerCase())}">
    <span class="item-corpo"><span class="item-nome nome-pessoa">${esc(cliente.nome)}</span></span>
  </button>`;
}
